import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type DepartmentCode = 'ROADS' | 'WATER' | 'WASTE' | 'ZONING' | 'HEALTH' | 'DEFAULT';

interface ThemeContextType {
  departmentCode: DepartmentCode;
  setDepartmentCode: (code: DepartmentCode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  departmentCode: 'DEFAULT',
  setDepartmentCode: () => {},
});

const themeConfig: Record<DepartmentCode, { primary: string; light: string; dark: string; name: string }> = {
  DEFAULT: { primary: '#3b82f6', light: '#93c5fd', dark: '#1d4ed8', name: 'Bedrock' },
  ROADS: { primary: '#f97316', light: '#fdba74', dark: '#c2410c', name: 'Roads & Infrastructure' }, // Orange
  WATER: { primary: '#0ea5e9', light: '#7dd3fc', dark: '#0369a1', name: 'Water & Sanitation' }, // Sky Blue
  WASTE: { primary: '#22c55e', light: '#86efac', dark: '#15803d', name: 'Waste Management' }, // Green
  ZONING: { primary: '#a855f7', light: '#d8b4fe', dark: '#7e22ce', name: 'City Planning' }, // Purple
  HEALTH: { primary: '#ec4899', light: '#f9a8d4', dark: '#be185d', name: 'Public Health' }, // Pink
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [departmentCode, setDepartmentCode] = useState<DepartmentCode>('DEFAULT');

  useEffect(() => {
    const root = document.documentElement;
    const config = themeConfig[departmentCode] || themeConfig['DEFAULT'];
    
    // Set explicit hex colors for Tailwind v4 to pick up via the @theme mapping
    root.style.setProperty('--color-primary', config.primary);
    root.style.setProperty('--color-primary-light', config.light);
    root.style.setProperty('--color-primary-dark', config.dark);
    
    root.setAttribute('data-department', departmentCode.toLowerCase());
    
    document.title = `${config.name} | Platform`;
  }, [departmentCode]);

  return (
    <ThemeContext.Provider value={{ departmentCode, setDepartmentCode }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);

