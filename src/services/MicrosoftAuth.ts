
import { toast } from 'sonner';

// Configuración para Microsoft Authentication
export const msalConfig = {
  clientId: '67553645-0db3-4480-b127-6f819a79e367', // Necesitarías registrar una aplicación en Azure AD
  authority: 'https://login.microsoftonline.com/common',
  redirectUri: window.location.origin,
};

// Request de inicio de sesión
export const loginRequest = {
  scopes: ['User.Read'],
};

// Función para inicializar MSAL (Microsoft Authentication Library)
export const initMSAL = async () => {
  try {
    // En una implementación real, se importaría y utilizaría la biblioteca MSAL
    // const msal = await import('@azure/msal-browser');
    // const publicClientApp = new msal.PublicClientApplication(msalConfig);
    // return publicClientApp;

    // Por ahora usamos una simulación
    console.log('Inicializando Microsoft Authentication...');
    
    return {
      loginPopup: async () => {
        console.log('Iniciando sesión con Microsoft...');
        
        // Simular inicio de sesión
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return {
          account: {
            name: 'Usuario Microsoft',
            username: 'usuario@universidad.edu',
          },
          idToken: 'token-simulado',
          accessToken: 'access-token-simulado',
        };
      },
      logout: async () => {
        console.log('Cerrando sesión de Microsoft...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };
  } catch (error) {
    console.error('Error inicializando MSAL', error);
    toast.error('Error al inicializar la autenticación de Microsoft');
    throw error;
  }
};

// Función para iniciar sesión con Microsoft
export const loginWithMicrosoft = async () => {
  try {
    const msalInstance = await initMSAL();
    const loginResponse = await msalInstance.loginPopup();
    
    // Aquí procesaríamos los datos del usuario y generaríamos una sesión
    const userData = {
      id: `ms-${Date.now()}`,
      firstName: loginResponse.account.name.split(' ')[0],
      lastName: loginResponse.account.name.split(' ').slice(1).join(' '),
      email: loginResponse.account.username,
      role: 'student', // Por defecto, ajustar según dominio u otra lógica
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Guardar en localStorage para simular persistencia
    localStorage.setItem('unisonUser', JSON.stringify(userData));
    
    return userData;
  } catch (error) {
    console.error('Error en inicio de sesión con Microsoft', error);
    toast.error('No se pudo iniciar sesión con Microsoft');
    throw error;
  }
};

// Función para cerrar sesión de Microsoft
export const logoutFromMicrosoft = async () => {
  try {
    const msalInstance = await initMSAL();
    await msalInstance.logout();
    
    // Limpiar localStorage
    localStorage.removeItem('unisonUser');
  } catch (error) {
    console.error('Error al cerrar sesión de Microsoft', error);
    toast.error('Error al cerrar sesión de Microsoft');
  }
};
