
// Configuracion de Odoo
const ODOO_CONFIG = {
    url: 'https://jh-serviparts.tic-odoo.com', // Ojo: Sin el / al final
    db: 'jh-serviparts',
    username: 'admin',
    apiKey: '62dbde3b346c4912d948ebdce7c75c8976d961f3',
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
export const authenticateOdoo = async (): Promise<number> => {
  try {
    const uid = await rpcCall('common', 'authenticate', [
      ODOO_CONFIG.db,
      ODOO_CONFIG.username,
      ODOO_CONFIG.apiKey,
      {},
    ]);

    if (!uid) {
      throw new Error('Credenciales incorrectas');
    }

    console.log('✅ Conectado a Odoo! UID:', uid);
    return uid;
  } catch (error) {
    console.error('Error Auth:', error);
    throw error;
  }
};

// 2. Obtener Productos
export const getProducts = async (uid: number) => {
  try {
    const products = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db,
      uid,
      ODOO_CONFIG.apiKey,
      'product.template', // Modelo
      'search_read',      // Método
      [[['type', '=', 'service']]], // Argumentos (Filtro)
      { fields: ['name', 'list_price'], limit: 5 }, // Kwargs (Opciones)
    ]);
    
    return products;
  } catch (error) {
    console.error('Error Products:', error);
    throw error;
  }
};