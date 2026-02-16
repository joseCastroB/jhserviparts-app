
// Configuracion de Odoo
export const ODOO_CONFIG = {
    url: 'https://jh-serviparts.tic-odoo.com', // Ojo: Sin el / al final
    db: 'jh-serviparts',
};

// Variable Global para guardar la sesión
export let ODOO_SESSION_ID = '';

// Función genérica para hacer peticiones JSON-RPC (Versión Robusta)
const rpcCall = async (service: string, method: string, args: any[]) => {
  try {
    const response = await fetch(`${ODOO_CONFIG.url}/jsonrpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Si tenemos sesión, la enviamos (útil para futuras llamadas)
        ...(ODOO_SESSION_ID ? { 'Cookie': `session_id=${ODOO_SESSION_ID}` } : {})
        
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
      console.error('Odoo Error:', json.error);
      throw new Error(json.error.data?.message || json.error.message);
    }

    return json.result;
  } catch (error) {
    console.error('Network/RPC Error:', error);
    throw error;
  }
};

// 1. Autenticación (CAMBIADO A /web/session/authenticate PARA ASEGURAR COOKIE)
export const authenticate = async (username: string, password: string): Promise<number> => {
  try {
    console.log('Intentando login en:', `${ODOO_CONFIG.url}/web/session/authenticate`);
    
    // Usamos el endpoint Web que garantiza la cookie de sesión
    const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: ODOO_CONFIG.db,
          login: username,
          password: password,
        },
        id: 1,
      }),
    });

    // --- CAPTURA DE COOKIE (BLINDADA) ---
    const headers = response.headers;
    // Intentamos obtener el header de varias formas (React Native a veces lo esconde)
    let cookieHeader = headers.get('set-cookie') || headers.get('Set-Cookie');
    
    // Hack para Android: a veces los headers están dentro de un mapa 'map'
    if (!cookieHeader && (headers as any).map) {
        cookieHeader = (headers as any).map['set-cookie'] || (headers as any).map['Set-Cookie'];
    }

    if (cookieHeader) {
        // Convertimos a string y buscamos el session_id
        const strCookie = String(cookieHeader);
        const match = strCookie.match(/session_id=([^;]+)/);
        if (match && match[1]) {
            ODOO_SESSION_ID = match[1];
            console.log('✅ Cookie Capturada:', ODOO_SESSION_ID);
        }
    }

    const json = await response.json();

    if (json.error) {
      throw new Error(json.error.data?.message || 'Error de credenciales');
    }

    // Este endpoint devuelve un objeto de sesión completo. El UID está dentro.
    const uid = json.result.uid;

    if (!uid) throw new Error('Usuario o contraseña incorrectos');
    
    // Respaldo: Si la cookie no vino en el header (raro), a veces Odoo la devuelve en el body
    if (!ODOO_SESSION_ID && json.result.session_id) {
        ODOO_SESSION_ID = json.result.session_id;
        console.log('✅ Cookie recuperada del body:', ODOO_SESSION_ID);
    }

    return uid;
  } catch (error) {
    console.error('Error Auth:', error);
    throw error;
  }
};

// 2. Obtener Productos (SIN LÍMITE)
export const getProducts = async (uid: number, password: string) => {
  try {
    const products = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password,
      'product.template',
      'search_read',     
      [[['type', '=', 'service']]],
      { fields: ['name', 'list_price'] }, // Sin limit
    ]);
    return products;
  } catch (error) {
    console.error('Error Products:', error);
    return [];
  }
};

// 3. Obtener Solicitudes de Mantenimiento (SIN LÍMITE)
export const getMaintenanceRequests = async (uid: number, password: string) => {
  try {
    const requests = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password,
      'maintenance.request',
      'search_read',
      [[]], 
      { 
        fields: [
            'id', 
            'name', 
            'request_title', 
            'stage_id', 
            'request_date',
            'partner_id'
        ], 
        order: 'id desc' // Sin limit
      }
    ]);
    return requests;
  } catch (error) {
    console.error('Error fetching requests:', error);
    return [];
  }
};

// 4. Crear nueva solicitud
export const createMaintenanceRequest = async (
    uid: number,
    password: string,
    data: any // Acepta cualquier estructura de datos
) => {
    try {
        const newId = await rpcCall('object', 'execute_kw', [
            ODOO_CONFIG.db, uid, password,
            'maintenance.request', 
            'create', 
            [data], 
        ]);
        console.log('✅ Solicitud creada con ID:', newId);
        return newId;
    } catch(error){
        console.error('Error Creating Request:', error);
        throw error;
    }
};

// 5. Actualizar solicitud
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

// 6. Obtener equipos (SIN LÍMITE)
export const getEquipments = async (uid: number, password: string, partnerId: number | null = null) => {
  try {
    const domain = partnerId ? [['partner_id', '=', partnerId]] : [];
    const equipments = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password, 
      'maintenance.equipment',
      'search_read',
      [domain],
      { fields: ['id', 'name', 'serial_no', 'partner_id'] }, // Sin limit
    ]);
    return equipments;
  } catch (error) {
    console.error('Error getting equipments:', error);
    return [];
  }
};

// 7. Obtener clientes (SIN LÍMITE)
export const getPartners = async (uid: number, password: string) => {
  try{
    const partners = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password, 
      'res.partner',
      'search_read',
      [],
      { fields: ['id', 'name'] }, // Sin limit
    ]);
    return partners;
  } catch (error){
    console.error('Error getting partners:', error);
    return [];
  }
};

// 8. Obtener usuarios/Técnicos (SIN LÍMITE)
export const getUsers = async (uid: number, password: string) => {
  try {
    const users = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password, 
      'res.users',
      'search_read',
      [],
      { fields: ['id', 'name'] }, // Sin limit
    ]);
    return users;
  } catch (error){
    console.error('Error getting users:', error);
    return [];
  }
};

// 9. Obtener detalles de solicitud
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
          'partner_id', 'equipment_id', 'technician_id', 
          'maintenance_type', 'hour_type', 
          'equipment_found_status', 'equipment_final_status', 
          'has_pending', 'pending_comments', 'service_rating', 
          'checklist_ids',
          'description', 
          'execution_start_date', 'execution_end_date',
          'customer_signature', 'signed_by_customer', 'signed_by_technician',
          'evidence_ids'
        ]
      }
    ]);
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error details:', error);
    return null;
  }
};

// 10. Obtener líneas de checklist
export const getChecklistLines = async (uid: number, password: string, lineIds: number[]) => {
  if (!lineIds || lineIds.length === 0) return [];
  try {
    const lines = await rpcCall('object', 'execute_kw', [
      ODOO_CONFIG.db, uid, password,
      'maintenance.checklist.line', 
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

// 11. Obtener adjuntos
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
