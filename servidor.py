"""Servidor local del catalogo.

Lo mismo que `python -m http.server`, con una diferencia: le pide al navegador
que NO guarde nada en cache. Sin esto, despues de editar el index.html el
navegador sigue mostrando la version anterior y parece que los cambios no se
aplicaron (pasa siempre, y confunde).

Se arranca con "ABRIR CATALOGO.bat", o a mano con: python servidor.py
"""
import http.server
import socketserver

PUERTO = 8765


class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    # Con hilos y no de a uno: una pagina del catalogo pide cientos de fotos y
    # el navegador abre varias conexiones a la vez. Atendiendolas en fila se
    # encolaban, alguna se colgaba y las pruebas figuraban como caidas.
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.daemon_threads = True
    # Solo esta compu (127.0.0.1), no toda la red (29/09). Con '' escuchaba en
    # todas las interfaces, y este servidor lista las carpetas: cualquiera en
    # el mismo wifi podia recorrer backups/, logs/ y las notas que .gitignore
    # deja afuera de la web, mientras estuviera abierto ABRIR CATALOGO o
    # corrieran las pruebas de la revision diaria. Nada lo abre desde otro
    # equipo: todo usa http://localhost:8765, y el celular se prueba con un
    # iframe en Chrome sin ventana, no con un telefono de verdad.
    with socketserver.ThreadingTCPServer(('127.0.0.1', PUERTO), SinCache) as srv:
        print('Catalogo andando en http://localhost:%d' % PUERTO)
        print('Para apagarlo, cerra esta ventana.')
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass
