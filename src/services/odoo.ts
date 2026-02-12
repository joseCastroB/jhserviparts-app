
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

// 5. Obtener equipos de mantenimiento
export const getEquipments = async (uid: number, password: string, partnerId: number | null = null) => {
  try {

    const domain = partnerId ? [['partner_id', '=', partnerId]] : [];

    const equipments = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password, 
      'maintenance.equipment',
      'search_read',
      [domain],
      { fields: ['id', 'name', 'serial_no', 'partner_id'], limit: 50},
    ]);
    return equipments;
  } catch (error) {
    console.error('Error getting equipments:', error);
    return [];
  }
};

// Obtener clientes
export const getPartners = async (uid: number, password: string) => {
  try{
    const partners = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password, 
      'res.partner',
      'search_read',
      [],
      { fields: ['id', 'name'], 
        //limit: 50
      },
    ]);
    return partners;
  } catch (error){
    console.error('Error getting partners:', error);
    return [];
  }
};

// 6. Obtener usuarios (Técnicos)
export const getUsers = async (uid: number, password: string) => {
  try {
    const users = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db,
      uid,
      password, 
      'res.users',
      'search_read',
      [],
      { fields: ['id', 'name'], limit:50 },
    ]);
    return users;
  } catch (error){
    console.error('Error getting users:', error);
    return [];
  }
};

// 7. Obtener detalles de solicitud 
export const getRequestDetails = async (uid: number, password: string, requestId: number) => {
  try{
    const data = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password,
      'maintenance.request',
      'read',
      [[requestId]],
      {
        fields: [
          'name', 'request_title', 
          'partner_id', 'equipment_id', 'technician_id', // Relaciones
          'maintenance_type', 'hour_type', 
          'equipment_found_status', 'equipment_final_status', // Estados
          'has_pending', 'pending_comments', 'service_rating', // Finales
          'checklist_ids', // IDs del checklist
          'description', 
          'execution_start_date', 'execution_end_date',
          'customer_signature', 'signed_by_customer', 'signed_by_technician', // Firmas
          'evidence_ids' // Fotos
        ]
      }
    ]);
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error details:', error);
    return null;
  }
};

// Obtener líneas de checklist
export const getChecklistLines = async (uid: number, password: string, lineIds: number[]) => {
  if (!lineIds || lineIds.length === 0) return [];
  try {
    const lines = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password,
      'maintenance.checklist.line', // Tu modelo de líneas
      'read',
      [lineIds],
      { fields: ['id', 'name', 'is_done'] }
    ]);
    return lines;
  } catch (error) {
    console.error('Error checklist:', error);
    return [];
  }
};

// 8. Obtener adjuntos (imagenes)
export const getAttachments = async (uid: number, password: string, attachmentIds: number[]) => {
  if(!attachmentIds || attachmentIds.length === 0) return [];
  try{
    const files = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password,
      'ir.attachment',
      'read',
      [attachmentIds],
      { fields : ['id', 'name', 'datas'] }     
    ]);
    return files;
  } catch (error){
    console.error('Error attachments:', error);
    return [];
  }
};

// 9. Actualizar solicitud
export const updateMaintenanceRequest = async (uid: number, password: string, requestId: number, data: any) => {
  try {
    const result = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password, 
      'maintenance.request',
      'write',
      [[requestId], data]
    ]);
    return result;
  } catch (error) {
    console.error('Error Update: ', error);
    throw error;
  }
};
