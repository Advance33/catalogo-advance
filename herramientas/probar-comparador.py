# -*- coding: utf-8 -*-
"""Prueba que es_el_mismo() no confunda dos productos parecidos.

    python herramientas/probar-comparador.py

Cada caso de aca abajo es un error que de verdad paso, o que estuvo a punto
de pasar. Son los que decidian si una ficha de mil dolares mostraba la foto
de otro telefono, asi que cada vez que se toque el comparador hay que correr
esto. Sale con 1 si alguno falla.
"""
import os, sys, io, csv, collections
AQUI = os.path.dirname(os.path.abspath(__file__))
os.chdir(os.path.dirname(AQUI))
sys.path.insert(0, os.getcwd()); sys.path.insert(0, AQUI)
import catalogo_maestro as CM, validar
sys.stdout.reconfigure(encoding='utf-8')
conocidos = validar.leer_index()[0]; pinta = validar.pinta

CASOS = [
    # (nombre en la planilla, nombre en el catalogo, precio a, precio b, deberia)
    ('MacBook Pro M5 14" 24GB/1TB (Space Black)', 'MacBook Pro M5 Pro 14" 24GB/1TB (Space Black)', '2563', '2970', False),
    ('iPhone 17 Pro 512GB (Orange)', 'iPhone 17 Pro Max 512GB (Orange)', '1490', '1690', False),
    ('iPhone 17 Pro 256GB (Silver)', 'iPhone 17 Pro Max 256GB (Silver)', '1200', '1400', False),
    ('Galaxy Z Fold 8 512GB (Garphite)', 'Galaxy Z Fold 8 Ultra 512GB (Graphite)', '2100', '2400', False),
    ('iPhone 17 256GB (Black)', 'iPhone 17 Air 256GB (Black)', '1000', '1200', False),
    ('Galaxy Tab S10 FE Wifi 8/128GB +Pencil (Gray)', 'Galaxy Tab S10 FE Plus Wifi 8/128GB +Pencil (Gray)', '500', '650', False),
    # codigos de modelo: un numero distinto es otro producto
    ('Galaxy A37 8/256GB (Gray)', 'Galaxy A36 8/256GB (White)', '400', '400', False),
    ('Galaxy A56 8/256GB (Gray)', 'Galaxy A27 5G 8/256GB (Black)', '450', '450', False),
    ('iPad Air 13" M4 128GB (Blue)', 'iPad Air M3 13" 128gb (Blue)', '990', '990', False),
    ('Galaxy Tab S11 12/128GB (X730)', 'Galaxy Tab S10 12/128GB (X730)', '700', '700', False),
    # el proveedor saca el primer GB: "16GB/256GB" -> "16/256GB" (11/09/2026)
    ('Mac Mini M4 16/256GB', 'Mac Mini M4 16GB/256GB', '700', '700', True),
    ('MacBook Pro M5 14" 24/1TB (Space Black)', 'MacBook Pro M5 14" 24GB/1TB (Silver)', '2563', '2563', True),
    ('MacBook Neo A18 13" 8/512GB (Citrus)', 'MacBook Neo A18 13" 8GB/512GB (Blush)', '957', '957', True),
    # pero un TB no es un GB
    ('MacBook Pro M5 14" 24/1TB', 'MacBook Pro M5 14" 24/1GB', '2563', '2563', False),
    # los que SI son el mismo producto y tienen que seguir pasando
    ('Galaxy A57 8/128GB 5G (Gray)', 'Galaxy A57 8/128GB (Gray)', '380', '380', True),
    ('G06 Power 4/64GB Sin Cargador (Laurel Oak)', 'G06 Power 4/64GB (Laurel Oak)', '150', '150', True),
    ('iPad 11" A16 128GB (Blue/Silver)', 'iPad 11 A16 128GB (Blue)', '400', '400', True),
    ('AirPods 4ta Con Cancelación De Ruido (ANC)', 'AirPods 4 Con Cancelación De Ruido (ANC)', '180', '180', True),
    ('Batería Smallrig USB-C FZ-100 (Rechargable)', 'Batería Smallrig USB-C FZ-100 (Recargable)', '60', '60', True),
    ('Watch Series 11 42mm GPS S/M (Rose Gold)', 'Watch Series 11 42mm GPS S/M (Jet Black/Silver)', '450', '450', True),
]
print('%-52s %-52s  esperado  dio' % ('planilla', 'catalogo'))
print('-' * 130)
fallos = 0
for a, b, pa, pb, esperado in CASOS:
    fila = {'Marca': 'X', 'Categoría': 'Y', 'Descripción completa': a, 'Precio USD': pa}
    entrada = {'Marca': 'X', 'Categoria': 'Y', 'Producto': b, 'Precio_alta': pb}
    dio = CM.es_el_mismo(fila, entrada, pinta, conocidos)
    ok = (dio == esperado)
    fallos += not ok
    print('%-52s %-52s  %-8s  %-6s %s' % (a[:52], b[:52], esperado, dio, '' if ok else '  <-- MAL'))
print()
print('%d de %d bien' % (len(CASOS) - fallos, len(CASOS)))
sys.exit(1 if fallos else 0)
