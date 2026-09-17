# -*- coding: utf-8 -*-
"""Las fotos chicas de la grilla y de la portada.

    python herramientas/miniaturas.py           las que falten
    python herramientas/miniaturas.py --todas   las rehace todas

POR QUE EXISTE
La portada de un celular bajaba 73 fotos de 900x900 (2,1 MB) para mostrarlas
del tamano de una estampilla: los rubros, la vidriera, las novedades y lo
mirado. Medido el 17/09/2026 con la pagina de verdad.

Estas copias de 400 px pesan la cuarta parte y se ven igual en ese tamano. La
de 900 queda para la ficha, que es donde el cliente mira el producto de cerca.

Viven en fotos/mini/ con EL MISMO NOMBRE que la grande (AT-0065-02.jpg), asi
la web arma una direccion de la otra sin tener que consultar ninguna lista.

Se regeneran solas al publicar: verificar-fotos.py llama a actualizar() antes
de escribir el indice, y una foto nueva o cambiada se lleva su chica al toque.
"""
import io
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
FOTOS = os.path.join(RAIZ, 'fotos')
MINIS = os.path.join(FOTOS, 'mini')
LADO = 400
CALIDAD = 78


def una(origen, destino):
    from PIL import Image
    im = Image.open(origen)
    if im.mode != 'RGB':
        im = im.convert('RGB')
    im.thumbnail((LADO, LADO), Image.LANCZOS)
    im.save(destino, 'JPEG', quality=CALIDAD, optimize=True, progressive=True)


def actualizar(rehacer=False, avisar=None):
    """Deja fotos/mini/ al dia. Devuelve (hechas, borradas, total)."""
    os.makedirs(MINIS, exist_ok=True)
    grandes = [f for f in os.listdir(FOTOS) if f.lower().endswith('.jpg')]
    hechas = 0
    for f in sorted(grandes):
        g, m = os.path.join(FOTOS, f), os.path.join(MINIS, f)
        # Si la grande cambio despues que la chica, la chica quedo vieja: es
        # justo el caso de una foto corregida, y mostrar la vieja seria peor
        # que no tener ninguna.
        if not rehacer and os.path.exists(m) and os.path.getmtime(m) >= os.path.getmtime(g):
            continue
        try:
            una(g, m)
            hechas += 1
            if avisar:
                avisar(f)
        except Exception as e:
            print('   no se pudo con %s: %s' % (f, e))
    # Las que ya no tienen grande no sirven para nada
    borradas = 0
    for f in os.listdir(MINIS):
        if f.lower().endswith('.jpg') and f not in set(grandes):
            os.remove(os.path.join(MINIS, f))
            borradas += 1
    return hechas, borradas, len(grandes)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    hechas, borradas, total = actualizar('--todas' in sys.argv)
    peso = lambda d: sum(os.path.getsize(os.path.join(d, f))
                         for f in os.listdir(d) if f.lower().endswith('.jpg'))
    print('%d chicas nuevas · %d borradas · %d fotos en total' % (hechas, borradas, total))
    if total:
        print('   grandes  %6.1f MB   (%d KB cada una)'
              % (peso(FOTOS) / 1048576, peso(FOTOS) // 1024 // total))
        print('   chicas   %6.1f MB   (%d KB cada una)'
              % (peso(MINIS) / 1048576, peso(MINIS) // 1024 // total))
    return 0


if __name__ == '__main__':
    sys.exit(main())
