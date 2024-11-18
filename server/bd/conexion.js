const mysql= require('mysql');



const conexion = mysql.createConnection({
    host:process.env.DB_HOST,
    database:process.env.DB_DATABASE,
    user:process.env.DB_USER,
    password:process.env.DB_PASSWORD
})



conexion.connect(function(err){
    if(err){
        console.log('el error es: '+ err);
        return
    }else{
        console.log('Conexion Exitosa');
    }
})
module.exports = conexion