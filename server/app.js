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

const jwt = require('jsonwebtoken')

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
                req.session.user = results[0].rut;
                req.session.name = results[0].nombre;
                req.session.id_rol = results[0].id_rol;
                res.json({ success: true, message: 'Iniciaste Sesion', user: req.session.user, icon:'success', rol: req.session.id_rol});
            }
        });
    } else {
        res.json({ success: false, message: 'Ingresa un usuario o una contraseña', icon:'warning' });
    }
});

// Obtener estado de sesión
app.get('/session', (req, res) => {
    if (req.session.loggedin) {
        res.json({ loggedIn: true, user: req.session.user, name: req.session.name, id_rol: req.session.id_rol });
    } else {
        res.json({ loggedIn: false });
    }
});

app.get('/odontologos', (req,res)=>{
    conexion.query('SELECT * FROM odontologos', async (error, results)=>{
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
    console.log(fecha, id_odontologo)
    conexion.query(
        `
        SELECT horas.hora, fechas.fecha
        FROM fechas
        INNER JOIN horas ON horas.id_odontologo = fechas.id_odontologo AND horas.id_fecha = fechas.id_fecha
        WHERE fechas.fecha = ? AND fechas.id_odontologo = ? `,
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

app.get('/fechas-disponibles', (req,res)=>{
    conexion.query(`
        SELECT fecha
        FROM fechas
        WHERE diponibilidad = "DISPONIBLE";
        `
        ,async (error, results)=>{
        if (results.length == 0){
        }else{
            res.json(results);
        }
    })
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