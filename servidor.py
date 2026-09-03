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
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PUERTO), SinCache) as srv:
        print('Catalogo andando en http://localhost:%d' % PUERTO)
        print('Para apagarlo, cerra esta ventana.')
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass
