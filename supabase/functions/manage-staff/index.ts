import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type StaffAction = 'list' | 'invite' | 'update' | 'deactivate' | 'activate';

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return respond(401, { error: 'Authentication is required' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Staff management function is missing Supabase environment configuration');
    return respond(500, { error: 'Staff management is not configured' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return respond(400, { error: 'Request body must be valid JSON' });
  }

  const action = payload.action as StaffAction;
  const departmentId = typeof payload.department_id === 'string' ? payload.department_id : '';
  if (!['list', 'invite', 'update', 'deactivate', 'activate'].includes(action) || !departmentId) {
    return respond(400, { error: 'A valid action and department are required' });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return respond(401, { error: 'Your session is invalid or has expired' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: actor, error: actorError } = await adminClient
    .from('profiles')
    .select('id, department_id, role, is_suspended')
    .eq('id', user.id)
    .single();

  if (actorError || !actor || actor.role !== 'admin' || actor.is_suspended || actor.department_id !== departmentId) {
    return respond(403, { error: 'Only an active admin of this department can manage its staff' });
  }

  if (action === 'list') {
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, full_name, phone, role, is_suspended, created_at')
      .eq('department_id', departmentId)
      .in('role', ['admin', 'staff'])
      .order('full_name');
    if (profilesError) {
      return respond(500, { error: 'Department staff could not be loaded' });
    }

    const emailResults = await Promise.all((profiles || []).map(async (profile) => {
      const { data, error } = await adminClient.auth.admin.getUserById(profile.id);
      return { id: profile.id, email: data.user?.email || '', error };
    }));
    if (emailResults.some(result => result.error)) {
      return respond(500, { error: 'Staff email addresses could not be loaded' });
    }

    const emailById = new Map(emailResults.map(item => [item.id, item.email]));
    return respond(200, {
      staff: (profiles || []).map(profile => ({
        ...profile,
        email: emailById.get(profile.id) || '',
      })),
    });
  }

  if (action === 'invite') {
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const fullName = typeof payload.full_name === 'string' ? payload.full_name.trim() : '';
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
    const role = payload.role === 'admin' ? 'admin' : payload.role === 'staff' ? 'staff' : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || !role) {
      return respond(400, { error: 'Provide a valid email, full name, and staff role' });
    }

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role, department_id: departmentId },
    });
    if (error || !data.user) {
      return respond(400, { error: error?.message || 'The invitation could not be created' });
    }

    if (phone) {
      const { error: phoneError } = await adminClient
        .from('profiles')
        .update({ phone })
        .eq('id', data.user.id)
        .eq('department_id', departmentId);
      if (phoneError) {
        console.error('Staff invitation succeeded but phone number could not be saved:', phoneError);
        return respond(500, { error: 'Invitation sent, but the phone number could not be saved' });
      }
    }

    return respond(200, { profile_id: data.user.id, message: 'Invitation sent' });
  }

  const profileId = typeof payload.profile_id === 'string' ? payload.profile_id : '';
  if (!profileId || profileId === user.id) {
    return respond(400, { error: 'Choose a different staff member' });
  }

  const { data: target, error: targetError } = await adminClient
    .from('profiles')
    .select('id, role, department_id, is_suspended')
    .eq('id', profileId)
    .eq('department_id', departmentId)
    .in('role', ['admin', 'staff'])
    .single();
  if (targetError || !target) {
    return respond(404, { error: 'Staff member was not found in this department' });
  }

  const nextRole = payload.role === 'admin' || payload.role === 'staff'
    ? payload.role
    : target.role;
  const isRemovingAdmin = target.role === 'admin'
    && (action === 'deactivate' || (action === 'update' && nextRole !== 'admin'));

  if (isRemovingAdmin) {
    const { count, error: countError } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', departmentId)
      .eq('role', 'admin')
      .eq('is_suspended', false);
    if (countError) {
      return respond(500, { error: 'Could not verify department admin coverage' });
    }
    if ((count || 0) <= 1) {
      return respond(409, { error: 'The department must keep at least one active admin' });
    }
  }

  if (action === 'update') {
    const fullName = typeof payload.full_name === 'string' ? payload.full_name.trim() : '';
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
    if (!fullName) {
      return respond(400, { error: 'Full name is required' });
    }

    const { error } = await adminClient
      .from('profiles')
      .update({ full_name: fullName, phone: phone || null, role: nextRole })
      .eq('id', profileId)
      .eq('department_id', departmentId);
    if (error) {
      return respond(500, { error: 'Staff details could not be saved' });
    }
    return respond(200, { message: 'Staff details updated' });
  }

  if (action === 'deactivate' || action === 'activate') {
    const suspend = action === 'deactivate';
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(profileId, {
      ban_duration: suspend ? '876000h' : 'none',
    });
    if (authUpdateError) {
      return respond(500, { error: `Staff access could not be ${suspend ? 'disabled' : 'restored'}` });
    }

    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({ is_suspended: suspend })
      .eq('id', profileId)
      .eq('department_id', departmentId);

    if (profileUpdateError) {
      await adminClient.auth.admin.updateUserById(profileId, {
        ban_duration: suspend ? 'none' : '876000h',
      });
      return respond(500, { error: `Staff profile could not be ${suspend ? 'deactivated' : 'reactivated'}` });
    }

    return respond(200, { message: suspend ? 'Staff access deactivated' : 'Staff access restored' });
  }

  return respond(400, { error: 'Unsupported staff action' });
});
