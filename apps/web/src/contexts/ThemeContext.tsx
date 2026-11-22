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
  DEFAULT: { primary: '#0b4b3b', light: '#e6f2e9', dark: '#07382d', name: 'Bedrock' },
  ROADS:   { primary: '#ea580c', light: '#ffedd5', dark: '#9a3412', name: 'Roads & Infrastructure' },
  WATER:   { primary: '#0284c7', light: '#e0f2fe', dark: '#0369a1', name: 'Water & Sanitation' },
  WASTE:   { primary: '#16a34a', light: '#dcfce7', dark: '#15803d', name: 'Waste Management' },
  ZONING:  { primary: '#7c3aed', light: '#ede9fe', dark: '#5b21b6', name: 'City Planning & Zoning' },
  HEALTH:  { primary: '#e11d48', light: '#ffe4e6', dark: '#9f1239', name: 'Public Health' },
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

