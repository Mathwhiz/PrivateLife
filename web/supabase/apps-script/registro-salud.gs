// Apps Script para la planilla del registro de comidas.
// Publica las filas de la hoja "Registro" en JSON para la edge function `salud`.
//
// Instalación (una vez):
//   1. En la planilla: Extensiones → Apps Script. Pegar este archivo.
//   2. Configuración del proyecto (engranaje) → Propiedades de la secuencia de
//      comandos → agregar TOKEN con el valor que te pasaron.
//   3. Implementar → Nueva implementación → Tipo: Aplicación web.
//      Ejecutar como: Yo.  Quién tiene acceso: Cualquier persona.
//   4. Autorizar, copiar la URL que termina en /exec y pasarla.
// Sin el TOKEN correcto no devuelve nada; la URL sola no alcanza.

function doGet(e) {
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || !e || !e.parameter || e.parameter.token !== token) {
    return respuesta_({ error: 'no autorizado' });
  }

  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Registro');
  if (!hoja) return respuesta_({ error: 'no encuentro la hoja Registro' });

  // getDisplayValues: todo como texto, tal cual se ve. getValues convertiría
  // las fechas a Date en UTC y podría correrlas un día.
  return respuesta_({
    actualizado: new Date().toISOString(),
    filas: hoja.getDataRange().getDisplayValues(),
  });
}

function respuesta_(cuerpo) {
  return ContentService.createTextOutput(JSON.stringify(cuerpo)).setMimeType(ContentService.MimeType.JSON);
}
