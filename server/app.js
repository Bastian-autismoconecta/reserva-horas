// Invocamos Express
const express = require('express');
const app = express();
const cors = require('cors');

// Usamos CORS para permitir solicitudes desde el frontend
app.use(cors({
    origin: 'http://localhost:3000', // el dominio de tu frontend
    credentials: true                // habilita las credenciales
  }));

// Captura de datos del formulario
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Invocamos dotenv
const dotenv = require('dotenv');
dotenv.config({ path: './env/.env' });

// Directorio público
app.use('/resources', express.static('public'));
app.use('/resources', express.static(__dirname + '/public'));

// Invocamos bcryptjs
const bcryptjs = require('bcryptjs');


// Variables de sesión
const session = require('express-session');
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

// Conexión a la base de datos
const conexion = require('./bd/conexion');

// Registro de usuario
app.post('/register', async (req, res) => {
    const { rut, pass, nombre, apellido, correo, sexo, fecha_nacimiento, numero } = req.body;
    let passwordHash = await bcryptjs.hash(pass, 8);
    const id_rol = '1';

    // Inicia una transacción
    conexion.beginTransaction((err) => {
        if (err) {
            console.error('Error al iniciar la transacción:', err);
            return res.status(500).json({ success: false, message: 'Error al iniciar la transacción' });
        }

        // Primera consulta: insertar en usuarios
        conexion.query(
            'INSERT INTO usuarios SET ?', 
            { rut, pass: passwordHash, nombre, apellido, correo, id_rol }, 
            (error, results) => {
                if (error) {
                    console.error('Error al insertar en usuarios:', error);
                    return conexion.rollback(() => {
                        res.status(500).json({ success: false, message: 'Error al registrar usuario' });
                    });
                }

                const id_usuarios = results.insertId; // ID del usuario insertado

                // Segunda consulta: insertar en pacientes
                conexion.query(
                    'INSERT INTO pacientes SET ?', 
                    { fecha_nacimiento, sexo, numero, id_usuarios }, 
                    (error) => {
                        if (error) {
                            console.error('Error al insertar en pacientes:', error);
                            return conexion.rollback(() => {
                                res.status(500).json({ success: false, message: 'Error al registrar paciente' });
                            });
                        }

                        // Confirmar la transacción si todo fue bien
                        conexion.commit((err) => {
                            if (err) {
                                console.error('Error al confirmar la transacción:', err);
                                return conexion.rollback(() => {
                                    res.status(500).json({ success: false, message: 'Error al confirmar la transacción' });
                                });
                            }

                            // Respuesta exitosa
                            res.json({ success: true, message: 'Registro exitoso!', icon: 'success' });
                        });
                    }
                );
            }
        );
    });
});

// Autenticación de usuario
app.post('/auth', async (req, res) => {
    const { rut, pass } = req.body;

    if (rut && pass) {
        conexion.query('SELECT * FROM usuarios WHERE rut = ?', [rut], async (error, results) => {
            if (results.length == 0 || !(await bcryptjs.compare(pass, results[0].pass))) {
                res.json({ success: false, message: 'Usuario o contraseña incorrectas', icon:'error' });
            } else {
                req.session.loggedin = true;
                req.session.id= results[0].id;
                req.session.rut = results[0].rut;
                req.session.name = results[0].nombre;
                req.session.id_rol = results[0].id_rol;
                req.session.id_usuarios = results[0].id_usuarios;

                res.json({ success: true, message: 'Iniciaste Sesion', rut: req.session.rut, icon:'success', rol: req.session.id_rol});
            }
        });
    } else {
        res.json({ success: false, message: 'Ingresa un usuario o una contraseña', icon:'warning' });
    }
});

// Obtener estado de sesión
app.get('/session', (req, res) => {
    if (req.session.loggedin) {
        res.json({ loggedIn: true, rut: req.session.rut, name: req.session.name, id_rol: req.session.id_rol, id_usuario: req.session.id_usuarios });
    } else {
        res.json({id_usuario: req.session.id_usuarios });
    }
});

app.get('/odontologos', (req,res)=>{
    conexion.query(
        `
        SELECT 
        o.id_odontologo,
        u.id_usuarios,
        u.nombre,
        u.apellido,
        o.sucursal,
        o.especialidad
        FROM usuarios u
        INNER JOIN odontologos o ON o.id_usuarios = u.id_usuarios
        `, async (error, results)=>{
        if (results.length == 0){
            console.log('no existen odontologos')
        }else{
            res.json(results);
        }
    })
})

app.get('/usuarios', (req, res) => {
    conexion.query(
    `
    SELECT 
    id_usuarios,
    rut,
    nombre, 
    apellido,
    correo, fecha_registro
    FROM usuarios
    `
    , async (error, results)=>{
        if (results.length == 0){
            console.log('no existen odontologos')
        }else{
            res.json(results);
        }
    })
})



app.get('/especialidades', (req,res)=>{
    conexion.query('SELECT especialidad FROM odontologos', async (error, results)=>{
        if (results.length == 0){
            console.log('no existen especialidades')
        }else{
            res.json(results);
        }
    })
})

app.get('/sucursales', (req,res)=>{
    conexion.query('SELECT sucursal FROM odontologos', async (error, results)=>{
        if (results.length == 0){
            console.log('no existen sucursales')
        }else{
            res.json(results);
        }
    })
})

app.post('/pacientes', (req,res)=>{
    const {id_usuarios} = req.body;
    console.log(id_usuarios)
    conexion.query(
        `
        SELECT p.id_paciente, u.nombre, u.rut
        FROM usuarios u
        INNER JOIN pacientes p ON p.id_usuarios = u.id_usuarios
        WHERE u.id_usuarios = ?;
        `,[id_usuarios]
        , async (error, results)=>{
        if (results.length == 0){
            console.log('no existen pacientes')
        }else{
            res.json(results);
        }
    })
})

app.post('/id-odontologos', (req, res )=>{
    const {id_usuarios} = req.body;
    conexion.query(
        `
        SELECT o.id_odontologo
        FROM usuarios u
        INNER JOIN odontologos o ON o.id_usuarios = u.id_usuarios
        WHERE u.id_usuarios = ?;
        `,[id_usuarios]
        , async (error, results)=>{
        if (results.length == 0){
            console.log('No existen odontologos')
        }else{
            res.json(results);
        }
    })
})

app.post('/id-pacientes', (req, res )=>{
    const {id_usuarios} = req.body;
    conexion.query(
        `
        SELECT p.id_paciente
        FROM usuarios u
        INNER JOIN pacientes p ON p.id_usuarios = u.id_usuarios
        WHERE u.id_usuarios = ?;
        `,[id_usuarios]
        , async (error, results)=>{
        if (results.length == 0){
            console.log('No existen pacientes id-pacientes')
        }else{
            res.json(results);
        }
    })
})




app.post('/filtro-especialidades', (req,res)=>{
    const {especialidad} = req.body;
    conexion.query(`
        SELECT odontologos.id_odontologo,
                odontologos.especialidad, 
               odontologos.sucursal, 
               usuarios.nombre, 
               usuarios.apellido, 
               usuarios.correo
        FROM odontologos
        INNER JOIN usuarios ON odontologos.id_usuarios = usuarios.id_usuarios
        WHERE odontologos.especialidad = ?
    `, [especialidad] , async (error, results)=>{
        if (results.length == 0){

        }else{
            res.json(results);
        }
    })
})

app.post('/filtro-sucursales', (req,res)=>{
    const {sucursal} = req.body;
    conexion.query(`
        SELECT odontologos.id_odontologo,
                odontologos.especialidad, 
               odontologos.sucursal, 
               usuarios.nombre, 
               usuarios.apellido, 
               usuarios.correo
        FROM odontologos
        INNER JOIN usuarios ON odontologos.id_usuarios = usuarios.id_usuarios
        WHERE odontologos.sucursal = ?
    `, [sucursal] , async (error, results)=>{
        if (results.length == 0){

        }else{
            res.json(results);
        }
    })
})

app.post('/horas', (req,res)=>{
    const {fecha, id_odontologo} = req.body
    conexion.query(
        `
        SELECT horas.hora, fechas.fecha, horas.id_horas
        FROM fechas
        INNER JOIN horas ON horas.id_odontologo = fechas.id_odontologo AND horas.id_fecha = fechas.id_fecha
        WHERE fechas.fecha = ? AND fechas.id_odontologo = ? AND horas.disponibilidad = "DISPONIBLE"`,
        [fecha, id_odontologo],
        (error, results) => {
            if (error) {
                return res.status(500).json({ error: "Error en el servidor" });
            }
            if (results.length === 0) {
                return res.json([]);
            }
            res.json(results);
        }
    );
})

app.get('/horas-disponibles', (req,res)=>{
    conexion.query(`
        SELECT horas
        FROM horas
        WHERE diponibilidad = "DISPONIBLE";
        `
        ,async (error, results)=>{
        if (results.length == 0){
        }else{
            res.json(results);
        }
    })
})

app.put('/registrar-hora', (req,res) =>{
    const {id_horas} = req.body;
    conexion.query(
    `
    UPDATE horas SET disponibilidad = "NO_DISPONIBLE" WHERE id_horas = ?
    `, [id_horas], async (err, results) =>{
        if (results.length == 0){

        }else{
            res.json({ success: true, message: 'Reservaste tu hora!', icon:'success'})
        }
    })
})

app.put('/confirmar-cita',(req,res)=>{
    const {id_citas} = req.body;

    conexion.query(
    `
    UPDATE citas SET estado = "CONFIRMADA" WHERE citas.id_citas = ?;
    `, [id_citas], async (err, results) =>{
        if (results.length == 0){
        }else{
            res.json({ success: true, message: 'confirmaste tu cita!', icon:'success'})
        }
    })
})

app.put('/cancelar-cita',(req,res)=>{
    const {id_citas} = req.body;

    conexion.query(
    `
    UPDATE citas SET estado = "CANCELADA" WHERE citas.id_citas = ?;
    `, [id_citas], async (err, results) =>{
        if (results.length == 0){
        }else{
            res.json({ success: true, message: 'cancelaste tu cita!', icon:'success'})
        }
    })
})


app.post('/registrar-citas', (req,res)=>{
    const {id_horas, id_paciente, id_odontologo} = req.body
    conexion.query(
        `
        INSERT INTO citas (id_paciente, id_odontologo, id_horas) VALUES (?,?,?)
        `,[id_paciente, id_odontologo, id_horas],
        (error, results) => {
            if (error) {
                return res.status(500).json({ error: "Error en el servidor" });
            }
            if (results.length === 0) {
                return res.json({ success: false, message: 'Error', icon:'warning'});
            }
            res.json({ success: true, message: 'Reservaste tu cita', icon:'success'});
        }
    );
})

app.post('/obtener-citas-odontologos', (req, res)=>{
    const {id_odontologo} = req.body
    conexion.query(
    `   
    SELECT        
		c.estado AS estado_cita,
        h.hora AS hora_cita,
        u.nombre AS nombre_usuario,
        u.apellido AS apellido_usuario,
        f.fecha AS fecha_cita
    FROM 
        citas c
    JOIN 
        horas h ON c.id_horas = h.id_horas
    JOIN 
        fechas f ON h.id_fecha = f.id_fecha
    JOIN 
        odontologos o ON f.id_odontologo = o.id_odontologo
    JOIN 
        pacientes p ON p.id_paciente  = c.id_paciente
    JOIN
    	usuarios u ON u.id_usuarios = p.id_usuarios
    WHERE 
        o.id_odontologo = ?;
        
    `,[id_odontologo],
        (error, results) => {
            if (results.length === 0) {
            }
            res.json(results);
        }
    )
})

app.post('/obtener-citas-pacientes', (req, res)=>{
    const {id_paciente} = req.body
    conexion.query(
    `   
    SELECT        
        c.estado AS estado_cita,
        h.hora AS hora_cita,
        u_paciente.nombre AS nombre_usuario,          -- Nombre del paciente
        u_paciente.apellido AS apellido_usuario,      -- Apellido del paciente
        f.fecha AS fecha_cita,
        u_odontologo.nombre AS nombre_odontologo,     -- Nombre del odontólogo
        u_odontologo.apellido AS apellido_odontologo, -- Apellido del odontólogo
        o.especialidad,
        o.sucursal,
        c.id_citas
    FROM 
        citas c
    JOIN 
        horas h ON c.id_horas = h.id_horas
    JOIN 
        fechas f ON h.id_fecha = f.id_fecha
    JOIN 
        pacientes p ON p.id_paciente = c.id_paciente
    JOIN
        usuarios u_paciente ON u_paciente.id_usuarios = p.id_usuarios  -- Datos del paciente
    JOIN
        odontologos o ON o.id_odontologo = c.id_odontologo  -- Datos del odontólogo (especialidad, sucursal)
    JOIN
        usuarios u_odontologo ON u_odontologo.id_usuarios = o.id_usuarios  -- Datos del odontólogo (nombre, apellido)
    WHERE 
        p.id_paciente = ?;
        
    `,[id_paciente],
        (error, results) => {
            if (results.length === 0) {
            }
            res.json(results);
        }
    )
})


// Cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true, message: 'Sesión cerrada', icon:'success' });
    });
});

// Iniciar servidor
app.listen(4000, () => {
    console.log('Servidor corriendo en http://localhost:4000');
});