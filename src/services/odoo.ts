
// Configuracion de Odoo
export const ODOO_CONFIG = {
    url: 'https://jh-serviparts.tic-odoo.com', // Ojo: Sin el / al final
    db: 'jh-serviparts',
};

// Función genérica para hacer peticiones JSON-RPC
const rpcCall = async (service: string, method: string, args: any[]) => {
  const response = await fetch(`${ODOO_CONFIG.url}/jsonrpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: service,
        method: method,
        args: args,
      },
      id: Math.floor(Math.random() * 1000000000),
    }),
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(json.error.data.message || json.error.message);
  }

  return json.result;
};

// 1. Autenticación (Login)
export const authenticateOdoo = async (username: string, password: string): Promise<number> => {
  try {
    const uid = await rpcCall('common', 'authenticate', [
      ODOO_CONFIG.db,
      username,
      password,    
      {},
    ]);

    if (!uid) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    console.log('✅ Conectado a Odoo! UID:', uid);
    return uid;
  } catch (error) {
    console.error('Error Auth:', error);
    throw error;
  }
};

// 2. Obtener Productos
export const getProducts = async (uid: number, password: string) => {
  try {
    const products = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db,
      uid,
      password,
      'product.template', // Modelo
      'search_read',      // Método
      [[['type', '=', 'service']]], // Argumentos (Filtro)
      { fields: ['name', 'list_price'], limit: 10 }, // Kwargs (Opciones)
    ]);
    
    return products;
  } catch (error) {
    console.error('Error Products:', error);
    throw error;
  }
};

// 3. Obtener Solicitudes de Mantenimiento
export const getMaintenanceRequests = async (uid: number, password: string) => {
    try{
        const requests = await rpcCall('object', 'execute_kw',[
            ODOO_CONFIG.db,
            uid,
            password,
            'maintenance.request', // Modelo Odoo
            'search_read',
            [], // Traer todas las solicitudes
            {
                fields: ['name', 'request_date', 'stage_id', 'priority'],
                limit: 20,
                order: 'id desc' // las mas recientes primero
            },
        ]);

        return requests;
    } catch (error){
        console.error('Error Maintenance:', error);
        throw error;
    }
};

// 4. Crear nueva solicitud de mantenimiento
export const createMaintenanceRequest = async (
    uid: number,
    password: string,
    data: { name: string; maintenance_type: 'corrective' | 'preventive'; description?: string}
) => {
    try {
        const newId = await rpcCall('object', 'execute_kw', [
            ODOO_CONFIG.db,
            uid,
            password,
            'maintenance.request', // Modelo
            'create', // Método para crear
            [data], // Los datos a guardar
        ]);

        console.log('✅ Solicitud creada con ID:', newId);
        return newId;
    }catch(error){
        console.error('Error Creating Request:', error);
        throw error;
    }
};