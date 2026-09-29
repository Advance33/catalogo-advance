# -*- coding: utf-8 -*-
"""
Revisión automática del catálogo, una vez por día.

El sitio lee ADVAPP EN VIVO (desde el 22/09; la planilla quedó congelada como
respaldo): si el parser rompe algo un martes, está roto en la web hasta que
alguien lo note, aunque no se publique nada. Esto mira los datos todos los
días y avisa solo cuando hay algo grave.

Cómo avisa:
  - Siempre deja el detalle en logs/revision-AAAA-MM-DD.txt
  - Si hay errores graves, ADVAPP no cargó precios, o las fotos tienen algo
    que frenaría la publicación (verificar-fotos.py), pone un archivo bien
    visible en el Escritorio y muestra una notificación.
  - Cuando los errores se resuelven, el archivo del Escritorio se borra solo.

Se instala una sola vez:  python3 revision-diaria.py --instalar  (en Windows: python).
En Mac queda como agente de launchd; en Windows, como tarea programada.
Para probarlo a mano:  python3 revision-diaria.py
Para probar como lee las salidas (sin red):  python3 revision-diaria.py --probar

Desde el 29/09 tambien avisa cuando una herramienta NO PUDO correr (antes solo
se leian lineas con formato, y una herramienta que reventaba quedaba callada y
hasta borraba el aviso del dia anterior), y cuando ADVAPP no contesta y la web
esta mostrando la planilla congelada del 22/09. Baja ADVAPP una sola vez, guarda
la copia en logs/advapp-AAAA-MM-DD.json y se la pasa a validar, verificar-fotos
y pedido-advapp (variable ADVAPP_COPIA): las tres miran el mismo dato, y al dia
siguiente se puede ver con cual corrio.

Las pruebas de la pagina (Pedro eligio 7.3 C el 29/09, muestra pruebas.html):
la notificacion cuenta solo las fallas NUEVAS ("2 falla(s) NUEVAS en la
pagina"), y avisa "Reclamar a ADVAPP" cuando algo ya pedido lleva mas de
DIAS_RECLAMO dias sin arreglarse. En el archivo del Escritorio cada nueva va
con cada ID en su linea, el reclamo agrupado por pedido, y las conocidas mas
recientes solo con el numero. Que es nuevo y que ya se pidio lo decide
pruebas/conocidas.json (se anota con herramientas/fallas-conocidas.py).
"""
import os, re, sys, subprocess, datetime, glob

AQUI      = os.path.dirname(os.path.abspath(__file__))
LOGS      = os.path.join(AQUI, 'logs')
ESCRITORIO = os.path.join(os.path.expanduser('~'), 'Desktop')
AVISO     = os.path.join(ESCRITORIO, 'AVISO - catalogo con errores.txt')
DIAS_LOG  = 30
TAREA     = 'Catalogo Advance Tecno - revision diaria'
HORA_DEF  = '14:00'   # despues de la carga de precios del mediodia de ADVAPP
# Lo pedido que lleva MAS de estos dias sin arreglarse se reclama (Pedro
# eligio 7.3 C el 29/09: "los 7 dias los elegis vos"; con 7 justos todavia no)
DIAS_RECLAMO = 7

MAC       = sys.platform == 'darwin'
AGENTE    = 'com.advancetecno.revision-diaria'
PLIST     = os.path.join(os.path.expanduser('~'), 'Library', 'LaunchAgents', AGENTE + '.plist')


def correr_ps(comando):
    return subprocess.run(['powershell', '-NoProfile', '-Command', comando],
                          capture_output=True, text=True, encoding='utf-8', errors='replace')


def launchctl(*args):
    return subprocess.run(['launchctl'] + list(args), capture_output=True, text=True)


def instalar_mac(hora):
    """El equivalente Mac de la tarea programada: un agente de launchd del
    usuario. Si la Mac estaba dormida a esa hora, corre al despertarse. Si
    estaba APAGADA o sin la sesion abierta, ese dia NO corre (launchd solo
    garantiza lo de dormida): por eso validar.py, que corre PUBLICAR, avisa
    cuando el ultimo log tiene mas de 36 horas (29/09).

    El interprete queda con la ruta de sys.executable a proposito: la de la
    formula (/opt/homebrew/opt/python@3.14/...) aguanta las actualizaciones
    3.14.x, y Pillow vive solo en ese site-packages. /opt/homebrew/bin/python3
    saltaria a otra version con un brew upgrade y verificar-fotos perderia en
    silencio el control de 900x900. --estado avisa si esa ruta desaparece."""
    import plistlib
    h, m = [int(x) for x in hora.split(':')]
    os.makedirs(LOGS, exist_ok=True)
    os.makedirs(os.path.dirname(PLIST), exist_ok=True)
    with open(PLIST, 'wb') as fh:
        plistlib.dump({
            'Label': AGENTE,
            'ProgramArguments': [sys.executable, os.path.join(AQUI, 'revision-diaria.py')],
            'WorkingDirectory': AQUI,
            'StartCalendarInterval': {'Hour': h, 'Minute': m},
            'StandardOutPath': os.path.join(LOGS, 'launchd.txt'),
            'StandardErrorPath': os.path.join(LOGS, 'launchd.txt'),
        }, fh)
    dominio = 'gui/%d' % os.getuid()
    launchctl('bootout', dominio, PLIST)            # por si ya estaba cargado
    r = launchctl('bootstrap', dominio, PLIST)
    if r.returncode == 0:
        print('Listo. La revisión va a correr todos los días a las %s.' % hora)
        print('Si la Mac estaba dormida a esa hora, corre cuando se despierta.')
        print('Si estaba apagada o sin la sesion abierta, ese dia no corre.')
        print('\nPara cambiar la hora:   python3 revision-diaria.py --instalar 14:00')
        print('Para sacarla:           python3 revision-diaria.py --desinstalar')
        return 0
    print('No se pudo registrar el agente:\n%s' % ((r.stderr or r.stdout or '').strip()[:600]))
    return 1


def desinstalar_mac():
    launchctl('bootout', 'gui/%d' % os.getuid(), PLIST)
    if os.path.exists(PLIST):
        os.remove(PLIST)
        print('Agente eliminado. Ya no se revisa sola.')
        return 0
    print('No estaba instalada.')
    return 1


def estado_mac():
    if not os.path.exists(PLIST):
        print('No esta instalada.')
        return 0
    import plistlib
    with open(PLIST, 'rb') as fh:
        datos = plistlib.load(fh)
    cal = datos.get('StartCalendarInterval', {})
    impreso = launchctl('print', 'gui/%d/%s' % (os.getuid(), AGENTE))
    cargado = impreso.returncode == 0
    print('Instalada%s. Corre todos los días a las %02d:%02d.'
          % ('' if cargado else ' (pero no cargada: volvé a correr --instalar)',
             cal.get('Hour', 0), cal.get('Minute', 0)))
    # 29/09: el agente apunta a un Python con la version en la ruta. Si esa
    # ruta desaparece (otra version de Python), launchd falla en silencio.
    interprete = (datos.get('ProgramArguments') or [''])[0]
    if interprete and not os.path.exists(interprete):
        print('OJO: el agente apunta a un Python que ya no esta (%s): volve a correr --instalar'
              % interprete)
    m = re.search(r'last exit code = (\S+)', impreso.stdout or '')
    if m:
        print('Como termino la ultima corrida del agente: %s' % m.group(1))
    logs = glob.glob(os.path.join(LOGS, 'revision-*.txt'))
    if logs:
        ultima = datetime.datetime.fromtimestamp(max(os.path.getmtime(x) for x in logs))
        horas = (datetime.datetime.now() - ultima).total_seconds() / 3600
        print('Ultima vez:  %s (hace %s)' % (ultima.strftime('%d/%m/%Y %H:%M'),
                                            '%d horas' % horas if horas < 48 else '%d dias' % (horas // 24)))
        if horas > 36:
            print('OJO: hace mas de 36 horas que no corre. Si la Mac estuvo apagada a las %02d:%02d, '
                  'ese dia no corre: se puede correr a mano con  python3 revision-diaria.py'
                  % (cal.get('Hour', 0), cal.get('Minute', 0)))
    else:
        print('Todavia no corrio nunca (no hay logs).')
    return 0


def instalar(hora):
    """Registra la tarea programada de Windows. No hace falta ser admin:
    es una tarea del usuario."""
    if MAC:
        return instalar_mac(hora)
    pythonw = os.path.join(os.path.dirname(sys.executable), 'pythonw.exe')
    if not os.path.exists(pythonw):
        pythonw = sys.executable          # peor es nada: se verá una ventana

    ps = (
        '$a = New-ScheduledTaskAction -Execute "%s" -Argument "revision-diaria.py" '
        '-WorkingDirectory "%s";'
        '$t = New-ScheduledTaskTrigger -Daily -At %s;'
        # StartWhenAvailable: si la máquina estaba apagada, corre al prender
        '$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries '
        '-DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10);'
        'Register-ScheduledTask -TaskName "%s" -Action $a -Trigger $t -Settings $s '
        '-Description "Revisa los datos del catalogo y avisa si hay errores graves." '
        '-Force | Out-Null;'
        '"ok"'
    ) % (pythonw, AQUI, hora, TAREA)

    r = correr_ps(ps)
    if r.returncode == 0 and 'ok' in (r.stdout or ''):
        print('Listo. La revisión va a correr todos los días a las %s.' % hora)
        print('Si la máquina estaba apagada a esa hora, corre cuando la prendas.')
        # "python" y no python3 a proposito (29/09): esto solo se imprime en
        # Windows, donde el comando es ese. En la Mac lo dice instalar_mac().
        print('\nPara cambiar la hora:   python revision-diaria.py --instalar 14:00')
        print('Para sacarla:           python revision-diaria.py --desinstalar')
        return 0
    print('No se pudo registrar la tarea:\n%s' % ((r.stderr or r.stdout or '').strip()[:600]))
    return 1


def desinstalar():
    if MAC:
        return desinstalar_mac()
    r = correr_ps('Unregister-ScheduledTask -TaskName "%s" -Confirm:$false; "ok"' % TAREA)
    if 'ok' in (r.stdout or ''):
        print('Tarea eliminada. Ya no se revisa sola.')
        return 0
    print('No estaba instalada, o no se pudo sacar.')
    return 1


def estado():
    if MAC:
        return estado_mac()
    r = correr_ps(
        '$t = Get-ScheduledTask -TaskName "%s" -ErrorAction SilentlyContinue;'
        'if($t){ $i = Get-ScheduledTaskInfo $t;'
        '"Instalada. Estado: " + $t.State;'
        '"Ultima vez:  " + $i.LastRunTime;'
        '"Proxima vez: " + $i.NextRunTime } else { "No esta instalada." }' % TAREA)
    print((r.stdout or '').strip())
    return 0


def _comillas_as(s):
    """Texto entre comillas para AppleScript."""
    return '"%s"' % s.replace('\\', '\\\\').replace('"', "'")


def notificar(titulo, texto):
    """Globo de notificación de Windows. Si falla, no pasa nada: el aviso
    de verdad es el archivo del Escritorio."""
    if MAC:
        script = 'display notification %s with title %s sound name "Basso"' % (
            _comillas_as(texto), _comillas_as(titulo))
        try:
            subprocess.run(['osascript', '-e', script], timeout=20, capture_output=True)
        except Exception:
            pass
        return
    ps = (
        "Add-Type -AssemblyName System.Windows.Forms;"
        "$n = New-Object System.Windows.Forms.NotifyIcon;"
        "$n.Icon = [System.Drawing.SystemIcons]::Warning;"
        "$n.BalloonTipIcon = 'Warning';"
        "$n.BalloonTipTitle = '%s';"
        "$n.BalloonTipText = '%s';"
        "$n.Visible = $true;"
        "$n.ShowBalloonTip(15000);"
        "Start-Sleep -Seconds 8;"
        "$n.Dispose()"
    ) % (titulo.replace("'", ""), texto.replace("'", ""))
    try:
        subprocess.run(['powershell', '-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps],
                       timeout=40, capture_output=True)
    except Exception:
        pass


def limpiar_logs_viejos(carpeta=None):
    """Borra los logs y las copias de ADVAPP de mas de DIAS_LOG dias. La fecha
    se busca en el nombre (antes se cortaba [9:19], que solo servia para el
    prefijo "revision-"; las copias pesan ~670 KB cada una, 29/09)."""
    carpeta = carpeta or LOGS
    corte = datetime.date.today() - datetime.timedelta(days=DIAS_LOG)
    # pruebas-*.json (29/09, 7.3): lo que clasifico correr.py --json ese dia
    for f in (glob.glob(os.path.join(carpeta, 'revision-*.txt'))
              + glob.glob(os.path.join(carpeta, 'advapp-*.json'))
              + glob.glob(os.path.join(carpeta, 'pruebas-*.json'))):
        m = re.search(r'(\d{4}-\d{2}-\d{2})', os.path.basename(f))
        if not m:
            continue                  # advapp-ultima-carga.json no tiene fecha: se queda
        try:
            if datetime.date.fromisoformat(m.group(1)) < corte:
                os.remove(f)
        except Exception:
            pass


def preparar_salida():
    """La tarea programada corre con pythonw.exe, que no tiene consola: ahí
    sys.stdout es None y cualquier print revienta. Se manda a la nada."""
    if sys.stdout is None:
        sys.stdout = open(os.devnull, 'w', encoding='utf-8')
    if sys.stderr is None:
        sys.stderr = sys.stdout
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


ADVAPP_URL = 'https://advapp-blond.vercel.app/api/catalog?resource=tecno-web'
INTENTOS  = 3          # antes de decir "ADVAPP no contesta"
ESPERA    = 10         # segundos entre intento e intento


def estado_advapp(hoy, intentos=INTENTOS, espera=ESPERA, url=None):
    """Baja ADVAPP UNA vez para toda la revision y dice como esta.

    Devuelve {'vieja': motivo o None, 'caido': motivo o None, 'copia': ruta o
    None, 'dato': texto para el log}.

    'vieja': ADVAPP no cargo precios hoy. Hasta el 26/09/2026 esto miraba la
    hoja Meta de la planilla, que dejo de actualizarse el 22/09 cuando la web
    paso a leer ADVAPP: habria avisado "la carga no corre" todos los dias.
    ADVAPP publica `verificado_hoy`, que es true cuando hay algun costo cargado
    en el dia. Sabado y domingo no se carga, asi que esos dias no se avisa.

    'caido': no contesto despues de varios intentos, o vino cortado. Hasta el
    29/09 esta funcion se tragaba el error y el fin de semana ni lo miraba: con
    ADVAPP caido la revision corria entera sobre la planilla del 22/09 y no lo
    decia. El que se saltea el fin de semana es verificado_hoy, no la caida. Si
    tampoco hay internet, eso lo dice validar (sale con 2) y no se alarma.

    'copia': la respuesta tal cual, en logs/advapp-AAAA-MM-DD.json. La reciben
    validar, verificar-fotos y pedido-advapp para mirar el MISMO dato (29/09: la
    falla del 28 no se pudo reconstruir porque cada una bajo el suyo)."""
    import json, time, urllib.request
    salida = {'vieja': None, 'caido': None, 'copia': None, 'dato': ''}
    error = ''
    for i in range(intentos):
        if i:
            time.sleep(espera)
        try:
            req = urllib.request.Request(url or ADVAPP_URL, headers={'User-Agent': 'revision-diaria.py'})
            with urllib.request.urlopen(req, timeout=60) as r:
                crudo = r.read()
                etag = r.headers.get('ETag') or ''
            d = json.loads(crudo.decode('utf-8'))
            n = len(d.get('productos') or [])
            declaradas = d.get('filas')
            if not n:
                raise ValueError('vino sin productos')
            if isinstance(declaradas, (int, float)) and n < declaradas:
                raise ValueError('trajo %d de las %d filas que declara' % (n, declaradas))
        except Exception as e:
            error = str(e)
            continue
        salida['dato'] = ('generado_en %s, %d filas (declara %s), etag %s'
                          % (d.get('generado_en'), n, declaradas, etag or '-'))
        try:
            os.makedirs(LOGS, exist_ok=True)
            copia = os.path.join(LOGS, 'advapp-%s.json' % hoy)
            with open(copia, 'wb') as fh:
                fh.write(crudo)
            salida['copia'] = copia
        except OSError:
            pass                      # sin copia cada herramienta baja la suya
        if datetime.date.today().weekday() < 5 and d.get('verificado_hoy') is False:
            salida['vieja'] = ('ADVAPP dice que hoy no se verifico ningun precio '
                               '(verificado_hoy = false): la web muestra los de la ultima carga')
        return salida
    salida['caido'] = '%d intentos: %s' % (intentos, error)
    salida['dato'] = 'NO CONTESTO (%s)' % salida['caido']
    return salida


def rubros_que_se_vaciaron(copia, carpeta=None):
    """Los rubros que en la copia anterior de ADVAPP tenian algo para vender y
    en la de hoy nada (29/09). El 28/09 a las 14:00 ADVAPP dejo los Objetivos
    enteros fuera de venta, y lo unico que lo noto fue la tanda de sugeridos,
    como si fuera un error de la pagina (la caja de "Te puede servir" quedaba
    vacia). La tanda ya no lo cuenta como falla; aca se avisa como lo que es,
    un dato de ADVAPP. 'Para vender' = activo, con stock y con precio. Compara
    contra la copia anterior que haya en logs/ (las guarda estado_advapp)."""
    import json
    carpeta = carpeta or LOGS
    si = lambda v: str(v if v is not None else '').strip().lower() in ('sí', 'si', 'true', '1', 'yes')

    def contar(ruta):
        with open(ruta, 'rb') as fh:
            d = json.loads(fh.read().decode('utf-8'))
        n = {}
        for p in d.get('productos') or []:
            cat = str(p.get('Categoría') or '').strip()
            if not cat:
                continue
            n.setdefault(cat, 0)
            try:
                precio = float(str(p.get('Precio USD') or '0').replace(',', '.'))
            except ValueError:
                precio = 0
            activo = p.get('Activo') in (None, '') or si(p.get('Activo'))
            if activo and si(p.get('Stock')) and precio > 0:
                n[cat] += 1
        return n

    fechadas = lambda f: re.search(r'\d{4}-\d{2}-\d{2}', os.path.basename(f))
    previas = sorted(f for f in glob.glob(os.path.join(carpeta, 'advapp-*.json'))
                     if fechadas(f) and os.path.abspath(f) != os.path.abspath(copia))
    if not previas:
        return []
    try:
        antes, hoy = contar(previas[-1]), contar(copia)
    except Exception:
        return []                     # una copia ilegible no es un rubro vacio
    fecha = fechadas(previas[-1]).group(0)
    return ['[ADVAPP] el rubro "%s" quedo sin nada para vender: el %s tenia %d con stock y precio, hoy 0'
            % (c, fecha, n) for c, n in sorted(antes.items()) if n > 0 and not hoy.get(c)]


def filas_sin_vista_previa(copia, carpeta=None):
    """Las filas de ADVAPP de hoy que todavia no tienen su vista previa para
    WhatsApp (decision 4.2, Pedro 29/09). Cada fila tiene su pagina p/<ID>.html
    con la foto, el modelo y la version, y las arma herramientas/vista-previa.py
    en cada PUBLICAR: una fila que ADVAPP sumo despues se comparte con la
    tarjeta general hasta el proximo PUBLICAR, y sin este aviso nadie se
    enteraba. Compara la copia del dia con p/indice.json; cuenta solo las
    filas que la web muestra (validar.fila_activa, la misma regla que siNo)."""
    import json
    carpeta = carpeta or os.path.join(AQUI, 'p')
    try:
        with open(copia, 'rb') as fh:
            productos = json.loads(fh.read().decode('utf-8')).get('productos') or []
    except Exception:
        return []                     # una copia ilegible ya la avisa validar
    try:
        with open(os.path.join(carpeta, 'indice.json'), encoding='utf-8') as fh:
            hechas = set(json.load(fh).get('ids') or [])
    except (OSError, ValueError, AttributeError):
        hechas = set()                # sin indice, ninguna fila tiene la suya
    try:
        import validar
        activa = validar.fila_activa
    except Exception as e:
        return ['[herramienta] no se pudieron mirar las vistas previas: %s' % str(e)[:140]]
    texto = lambda v: '' if v is None else str(v)
    faltan = sorted({texto(p.get('ID')).strip() for p in productos
                     if texto(p.get('ID')).strip() and activa({k: texto(v) for k, v in p.items()})}
                    - hechas)
    if not faltan:
        return []
    return ['[publicar] %d fila(s) de ADVAPP sin vista previa para WhatsApp (%s%s): se comparten '
            'con la tarjeta general hasta el proximo PUBLICAR, que las arma solo'
            % (len(faltan), ', '.join(faltan[:5]), '...' if len(faltan) > 5 else '')]


def separar_avisos(lineas):
    """(errores, avisos). Lo que se arregla solo con el proximo PUBLICAR
    ('[publicar] ...', hoy las filas sin vista previa) es un aviso: va al log
    y, si el archivo del Escritorio sale por otra cosa, abajo, como aviso;
    solo no deja el archivo ni la notificacion (29/09, revision). Lo demas
    (que no se hayan podido mirar: '[herramienta] ...') es un error."""
    avisos = [x for x in lineas if x.startswith('[publicar]')]
    return [x for x in lineas if x not in avisos], avisos


def ultimo_error(texto):
    """La ultima linea de un Traceback (la que dice QUE se rompio), o ''."""
    if 'Traceback' not in (texto or ''):
        return ''
    cola = texto[texto.rindex('Traceback'):].strip().split('\n')
    return cola[-1].strip()[:160] if cola else ''


def analizar_validar(salida, rc):
    """(graves, respaldo, fallo). validar sale con 1 cuando hay graves, con 2
    cuando no pudo leer nada (sin internet): 1 SIN graves, u otro codigo, es
    que revento (29/09: con el maestro roto terminaba en Traceback y la
    revision decia "sin errores graves" y borraba el aviso)."""
    graves, dentro = [], False
    for linea in salida.split('\n'):
        if 'ERRORES GRAVES' in linea:
            dentro = True
            continue
        if dentro:
            if linea.strip().startswith('['):
                graves.append(linea.rstrip())
            elif linea.strip().startswith('Se arreglan en'):
                break
    respaldo = next((l.strip() for l in salida.split('\n') if l.startswith('FUENTE-RESPALDO')), '')
    fallo = ''
    if (rc == 1 and not graves) or rc not in (0, 1, 2):
        e = ultimo_error(salida)
        fallo = '[herramienta] validar.py no pudo terminar (salida %s)%s' % (rc, (': ' + e) if e else '')
    return graves, respaldo, fallo


def analizar_fotos(salida, rc, sin_internet=False):
    """(fotos_mal, fallo). verificar-fotos sale con 1 por lo que frena la
    publicacion; si sale con 1 y ningun contador '<--' lo explica, o es el
    choque de columnas CODIGO (que hasta el 29/09 quedaba callado: el 28/09
    hubo 33) o es que revento. Desde el 29/09 verificar-fotos tiene su propio
    contador '<--' para las columnas de ADVAPP que apuntan a otro producto, y
    la otra memoria del mismo modelo va sin flecha (Pedro, 26/09: no se
    avisa); la busqueda de "choque:" de abajo queda para una salida vieja.

    29/09: sin internet (validar salio con 2) verificar-fotos tambien sale
    con 1 y sin ningun '<--', porque no pudo bajar ni ADVAPP ni la planilla
    (SystemExit 'ERROR: no se pudo bajar la planilla'). Eso no es una
    herramienta rota y no se alarma, igual que el pedido y las pruebas ese
    dia: si no, cada dia sin conexion dejaba el AVISO en el Escritorio y la
    notificacion. Un Traceback, o el mismo corte con internet (validar si
    bajo los datos), si avisa, y ahora con la linea ERROR que dice por que."""
    fotos_mal = []
    for linea in salida.split('\n'):
        if '<--' in linea:
            n = linea.strip().split()[0] if linea.strip() else ''
            if n.isdigit() and int(n) > 0:
                fotos_mal.append('[fotos] ' + ' '.join(linea.split('<--')[0].split()))
    fallo = ''
    e = ultimo_error(salida)
    if rc == 1 and not fotos_mal:
        choques = [l for l in salida.split('\n') if re.match(
            r'\s+(choque:|codigo que no existe|celda corrida)', l)]
        if 'LAS COLUMNAS DE LA PLANILLA NO COINCIDEN' in salida and choques and not e:
            fotos_mal.append('[fotos] %d diferencia(s) entre la columna CODIGO de ADVAPP y el '
                             'catalogo maestro  ->  python3 verificar-fotos.py' % len(choques))
        elif sin_internet and not e and 'ERROR: no se pudo bajar la planilla' in salida:
            pass                      # sin conexion: ya lo dice validar (ver arriba)
        else:
            # el SystemExit('ERROR: ...') no deja Traceback: se cita esa linea
            e = e or next((l.strip() for l in salida.split('\n') if l.startswith('ERROR:')), '')[:160]
            fallo = '[herramienta] verificar-fotos.py no pudo terminar%s' % ((': ' + e) if e else '')
    elif rc not in (0, 1) or e:
        fallo = '[herramienta] verificar-fotos.py no pudo terminar (salida %s)%s' % (rc, (': ' + e) if e else '')
    return fotos_mal, fallo


def analizar_pruebas(salida, rc, sin_internet=False, corrida=None):
    """(pagina_mal, fallo). rc None = se corto por tiempo.

    Hasta el 29/09 solo contaban las lineas FALLA. Una tanda que revienta sale
    como EXCEPCION y una que no termina como NO LLEGO A CORRER, y correr.py las
    cuenta como falla (es lo que ya habia dejado pasar JS roto en PUBLICAR):
    aca se perdian las dos, y tambien el "no encontre Chrome" y el timeout.

    Con la clasificacion de correr.py (corrida: su --json) llegan solo las
    NUEVAS, una entrada por comprobacion con cada ID en su linea (Pedro eligio
    7.3 C el 29/09; antes cada falla era una linea cortada a 160 y el tercer ID
    quedaba en "AT-00"). Lo ya pedido va aparte, en reclamos(). Sin el JSON
    todo cuenta como nuevo, como antes. correr.py sale con 3 cuando lo unico
    que falla ya esta pedido: eso no es "terminaron mal"."""
    lineas = salida.split('\n')
    if corrida is not None:
        pagina_mal, grupos = [], {}
        for x in corrida.get('nuevas') or []:
            if x.get('tipo') != 'no_corrio':          # esas van abajo, como siempre
                grupos.setdefault((x.get('tanda'), x.get('comprobacion')), []).append(x)
        for (tanda, comp), xs in grupos.items():
            renglones = ['[pagina] NUEVA: %s' % (comp if any(x.get('id') for x in xs) else '%s: %s' % (tanda, comp))]
            for x in xs:
                if x.get('id'):
                    renglones.append('         %s: %s' % (x['id'], x.get('detalle') or ''))
                elif x.get('detalle'):
                    renglones.append('         ' + x['detalle'])
                if x.get('nota'):
                    renglones.append('         ' + x['nota'])
            pagina_mal.append('\n'.join(r.rstrip() for r in renglones))
    else:
        pagina_mal = ['[pagina] ' + (l.strip()[len('FALLA'):].strip() if l.strip().startswith('FALLA')
                                     else l.strip())[:160]
                      for l in lineas if l.strip().startswith('FALLA') or l.strip().startswith('EXCEPCION')]
    # (29/09, revision) Cada tanda caida sale DOS veces en la salida de
    # correr.py: arriba ("  guardas-b6-portada NO LLEGO A CORRER") y en NUEVAS
    # ("  guardas-b6-portada | NO LLEGO A CORRER"). Juntando toda linea que
    # terminara asi, el archivo decia "2 tanda(s) no llegaron a correr:
    # guardas-b6-portada, guardas-b6-portada" y la notificacion "1 falla(s)".
    # Con el JSON, las caidas son sus nuevas 'no_corrio'; sin el, solo la
    # linea de arriba (la que no tiene "|"), y cada tanda una vez.
    if corrida is not None:
        no_corrieron = [x.get('tanda') or '?' for x in corrida.get('nuevas') or []
                        if x.get('tipo') == 'no_corrio']
    else:
        no_corrieron = re.findall(r'^\s{2}(\S+)\s+NO LLEGO A CORRER\r?$', salida, re.M)
    no_corrieron = list(dict.fromkeys(no_corrieron))
    if no_corrieron and not sin_internet:
        pagina_mal.append('[pagina] %d tanda(s) no llegaron a correr: %s'
                          % (len(no_corrieron), ', '.join(no_corrieron[:8])))
    fallo = ''
    if rc is None:
        fallo = '[herramienta] las pruebas tardaron mas de 15 minutos y se cortaron'
    elif rc == 2:
        primera = next((l.strip() for l in lineas if l.strip()), '')
        fallo = '[herramienta] las pruebas no pudieron correr: ' + primera[:120]
    elif rc not in (0, 3) and not pagina_mal and not (no_corrieron and sin_internet):
        e = ultimo_error(salida)
        fallo = '[herramienta] las pruebas terminaron mal (salida %s) sin decir que fallo%s' % (
            rc, (': ' + e) if e else '')
    return pagina_mal, fallo


def leer_corrida(ruta):
    """La clasificacion que dejo correr.py --json, o None si no esta o no se
    puede leer (entonces todo cuenta como nuevo, como antes del 29/09)."""
    import json
    try:
        with open(ruta, encoding='utf-8') as fh:
            d = json.load(fh)
    except (OSError, ValueError):
        return None
    return d if isinstance(d, dict) and isinstance(d.get('nuevas'), list) else None


def clasificador():
    """herramientas/fallas-conocidas.py (lleva guion: se carga por la ruta),
    o None si no carga. Se carga recien cuando hace falta: roto, la revision
    igual corre y avisa (su --probar falla y eso llega al aviso)."""
    import importlib.util
    try:
        spec = importlib.util.spec_from_file_location(
            'fallas_conocidas', os.path.join(AQUI, 'herramientas', 'fallas-conocidas.py'))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod
    except Exception:
        return None


def contar_nuevas(corrida, sin_internet=False):
    """Las fallas nuevas, como las cuenta correr.py: cada fila una, y lo que no
    se ve de una lista cortada, las que faltan. (29/09, revision) La cuenta es
    la de fallas-conocidas.py, la misma que imprime correr.py: aca habia una
    copia que podia quedar distinta. Sin internet no cuentan las tandas que no
    corrieron. Si fallas-conocidas.py no carga, una por entrada (nunca menos
    que nada)."""
    nuevas = [x for x in corrida.get('nuevas') or []
              if not (sin_internet and x.get('tipo') == 'no_corrio')]
    fc = clasificador()
    return fc.contar_nuevas(nuevas) if fc is not None else len(nuevas)


def reclamos(corrida, hoy=None):
    """(lineas para el archivo, frases para la notificacion, cuantas conocidas
    recientes). Lo ya pedido que lleva MAS de DIAS_RECLAMO dias sin
    arreglarse, agrupado por a quien y cuando se pidio (Pedro eligio 7.3 C el
    29/09). Las conocidas mas recientes van solo con el numero."""
    hoy = hoy or datetime.date.today()
    viejas, recientes = {}, 0
    for c in (corrida or {}).get('conocidas') or []:
        try:
            d = (hoy - datetime.date.fromisoformat(c.get('fecha'))).days
        except (TypeError, ValueError):
            continue
        if d > DIAS_RECLAMO:
            viejas.setdefault((c.get('a') or 'ADVAPP', c['fecha']), []).append(c)
        else:
            recientes += 1
    lineas, por_quien = [], {}
    for (a, f), cs in sorted(viejas.items(), key=lambda kv: kv[0][1]):
        d = (hoy - datetime.date.fromisoformat(f)).days
        grupos = {}
        for c in cs:
            g = c.get('grupo') or c.get('nombre') or c.get('id')
            grupos[g] = grupos.get(g, 0) + 1
        lineas.append('[%s] RECLAMAR: %d fila(s) pedidas el %s siguen igual (%d dias)\n%s' % (
            a, len(cs), datetime.date.fromisoformat(f).strftime('%d/%m'), d,
            '\n'.join('         %s (%d)' % (g, n) for g, n in grupos.items())))
        n, dias = por_quien.get(a, (0, []))
        por_quien[a] = (n + len(cs), dias + [d])
    frases = ['Reclamar a %s: %d fila(s) pedidas hace %s dias.' % (
        a, n, ('%d' % min(dias)) if min(dias) == max(dias) else '%d a %d' % (min(dias), max(dias)))
        for a, (n, dias) in por_quien.items()]
    return lineas, frases, recientes


def analizar_pedido(salida, rc):
    """(pedido_mal, fallo, caido). pedido-advapp sale con 0 o 1 (1 = hay
    nuevos o volvieron) y con 2 cuando no pudo armar el pedido: ADVAPP caido
    (eso ya lo avisa la linea de ADVAPP) o el registro danado, que hasta el
    29/09 nadie veia porque solo se buscaba "(N nuevos"."""
    pedido_mal = []
    if rc == 2 and 'ADVAPP no contesto' in salida:
        return pedido_mal, '', True
    if rc not in (0, 1) or 'Traceback' in salida or 'Pedido a ADVAPP:' not in salida:
        ultima = ultimo_error(salida) or next((l.strip() for l in reversed(salida.split('\n')) if l.strip()), '')
        return pedido_mal, '[herramienta] el pedido a ADVAPP no se pudo armar (salida %s): %s' % (
            rc, ultima[:200]), False
    m = re.search(r'\((\d+) nuevos', salida)
    if m and int(m.group(1)):
        pedido_mal.append('[ADVAPP] %s punto(s) nuevos para pedirles  ->  PEDIDO-ADVAPP.txt '
                          '(cuando se mande: pedido-advapp.py --enviado)' % m.group(1))
    # Un punto que habian arreglado y volvio no es "nuevo", pero hay que
    # volver a pedirlo: hasta el 29/09 salia como "sigue igual" y no avisaba.
    m = re.search(r'Volvieron: (\d+)', salida)
    if m and int(m.group(1)):
        pedido_mal.append('[ADVAPP] %s punto(s) que habian arreglado volvieron  ->  PEDIDO-ADVAPP.txt'
                          % m.group(1))
    m = re.search(r'Pendientes nuestros: (\d+)(?: \(codigos: (\d+), colores sin registrar: (\d+)\))?', salida)
    if m and int(m.group(1)):
        if m.group(2) is not None:
            partes = [x for x in (
                ('%s fila(s) esperan que les demos codigo' % m.group(2)) if int(m.group(2)) else '',
                ('%s color(es) nuevo(s) sin registrar en el maestro (sin eso no hay foto)' % m.group(3))
                if int(m.group(3)) else '') if x]
            pedido_mal.append('[nuestro] %s  ->  PENDIENTES-NUESTROS.txt' % '; '.join(partes))
        else:
            pedido_mal.append('[nuestro] %s fila(s) esperan que les demos codigo  ->  '
                              'PENDIENTES-NUESTROS.txt' % m.group(1))
    return pedido_mal, '', False


def correr(exe, args, env, timeout=None):
    return subprocess.run([exe] + args, cwd=AQUI, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', env=env, timeout=timeout,
                          creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))


def main():
    preparar_salida()

    if '--instalar' in sys.argv:
        i = sys.argv.index('--instalar')
        hora = sys.argv[i + 1] if len(sys.argv) > i + 1 else HORA_DEF
        return instalar(hora)
    if '--desinstalar' in sys.argv:
        return desinstalar()
    if '--estado' in sys.argv:
        return estado()
    if '--probar' in sys.argv:
        return probar()

    os.makedirs(LOGS, exist_ok=True)
    hoy = datetime.date.today().isoformat()
    ahora = datetime.datetime.now().strftime('%d/%m/%Y %H:%M')

    # Corriendo bajo pythonw, sys.executable es pythonw.exe. Para el validador
    # preferimos python.exe, que sí tiene salida estándar.
    exe = sys.executable
    if os.path.basename(exe).lower() == 'pythonw.exe':
        alt = os.path.join(os.path.dirname(exe), 'python.exe')
        if os.path.exists(alt):
            exe = alt

    # ADVAPP, una sola vez para todas (ver estado_advapp)
    advapp = estado_advapp(hoy)
    env = dict(os.environ)
    if advapp['copia']:
        env['ADVAPP_COPIA'] = advapp['copia']
    # Un rubro entero que ADVAPP dejo sin nada para vender (29/09)
    vaciados = rubros_que_se_vaciaron(advapp['copia']) if advapp['copia'] else []
    # Las filas nuevas sin su vista previa para WhatsApp (decision 4.2, 29/09)
    sin_vista = filas_sin_vista_previa(advapp['copia']) if advapp['copia'] else []

    r = correr(exe, ['validar.py', '--todo'], env)
    salida = (r.stdout or '') + (r.stderr or '')

    log = os.path.join(LOGS, 'revision-%s.txt' % hoy)
    with open(log, 'w', encoding='utf-8') as f:
        f.write('Revisión del catálogo — %s\n%s\n\nADVAPP: %s%s\n\n%s'
                % (ahora, '=' * 60, advapp['dato'],
                   ('\nCopia usada por validar, verificar-fotos y pedido-advapp: %s' % advapp['copia'])
                   if advapp['copia'] else '', salida))
    limpiar_logs_viejos()

    # Sólo las líneas de error grave, para el aviso
    graves, respaldo, fallo_validar = analizar_validar(salida, r.returncode)
    sin_internet = r.returncode == 2
    herramienta_mal = [x for x in (fallo_validar,) if x]

    # ADVAPP no contesto y Google si (validar uso la planilla de respaldo): la
    # web esta mostrando precios y stock del 22/09 con el sello de su fecha, y
    # nadie se enteraba (29/09). Sin internet del todo, validar sale con 2 y no
    # se alarma, como siempre.
    caida = []
    if respaldo and not sin_internet:
        caida.append('[ADVAPP] NO CONTESTA: la web esta mostrando la planilla congelada del 22/09 '
                     '(%s)' % (advapp['caido'] or respaldo[len('FUENTE-RESPALDO:'):].strip())[:200])

    # Los colores que ADVAPP trajo y la web no sabe pintar. El validador los da
    # como aviso leve y por eso nadie los veia: el 26/09 habia cuatro. Se
    # avisan con el comando que los resuelve (mide el tono en nuestra foto).
    # Con ADVAPP caido se calcularian sobre la planilla: ese dia no.
    nuevos = sorted({m.group(1) for m in re.finditer(
        r'color "(.+?)" no está en el mapa COLORES', salida)})
    colores_mal = (['[colores] %d color(es) sin puntito en la web: %s  ->  python3 '
                    'herramientas/colores-nuevos.py' % (len(nuevos), ', '.join(nuevos))]
                   if nuevos and not caida else [])

    # Si ADVAPP no cargo precios hoy, el sitio sigue mostrando los viejos con
    # toda naturalidad: esta es la unica forma de enterarse sin abrir ADVAPP.
    vieja = advapp['vieja']
    with open(log, 'a', encoding='utf-8') as f:
        f.write('\n\nCarga de precios en ADVAPP: %s\n' % (vieja or ('no se pudo leer' if advapp['caido']
                                                                   else 'al dia')))
        f.write('Rubros que quedaron sin nada para vender: %s\n' % ('\n  '.join([''] + vaciados) if vaciados
                                                                 else 'ninguno'))
        f.write('Vistas previas para WhatsApp (p/): %s\n' % ('\n  '.join([''] + sin_vista) if sin_vista
                                                             else 'todas las filas tienen la suya'))

    # Las fotos. verificar-fotos.py frena por las formas que tiene una ficha
    # de mostrar otro producto u otro color, y por la columna CODIGO de ADVAPP
    # cuando apunta a otro producto (otra Sim, otro teclado u otro modelo; la
    # otra memoria del mismo modelo no, Pedro 26/09). Sin esto, eso se ve
    # recien al publicar. (29/09: aca decia tambien "las fotos que perdieron
    # su producto al cambiar el SKU", el 5b, que ya no existe.)
    rf = correr(exe, ['verificar-fotos.py'], env)
    salida_f = (rf.stdout or '') + (rf.stderr or '')
    fotos_mal, fallo_fotos = analizar_fotos(salida_f, rf.returncode, sin_internet)
    herramienta_mal += [x for x in (fallo_fotos,) if x]
    with open(log, 'a', encoding='utf-8') as f:
        f.write('\nFotos (verificar-fotos.py, salida %s):\n%s\n' % (rf.returncode, salida_f))

    # Las pruebas de la pagina (pruebas/correr.py): abren el catalogo con los
    # datos de hoy en Chrome sin ventana y miran lo que ve el cliente. El
    # 26/09 fueron lo unico que encontro los errores de verdad; el validador
    # decia "sin errores graves". Tardan un par de minutos.
    # 29/09 (7.3 C): con --detalle el log sigue teniendo cada FALLA tal cual, y
    # con --json deja que es nuevo y que ya se pidio (pruebas/conocidas.json).
    # El JSON del dia se borra antes: nunca se lee el de una corrida anterior.
    json_p = os.path.join(LOGS, 'pruebas-%s.json' % hoy)
    try:
        os.remove(json_p)
    except OSError:
        pass
    try:
        rp = correr(exe, [os.path.join('pruebas', 'correr.py'), '--detalle', '--json', json_p], env, timeout=900)
        salida_p, rc_p = (rp.stdout or '') + (rp.stderr or ''), rp.returncode
    except subprocess.TimeoutExpired:
        salida_p, rc_p = 'las pruebas tardaron mas de 15 minutos y se cortaron', None
    corrida = leer_corrida(json_p) if rc_p is not None else None
    pagina_mal, fallo_pruebas = analizar_pruebas(salida_p, rc_p, sin_internet, corrida)
    n_nuevas = contar_nuevas(corrida, sin_internet) if corrida is not None else len(pagina_mal)
    # Lo pedido hace mas de DIAS_RECLAMO dias y que sigue igual
    reclamar, frases_reclamo, recientes = reclamos(corrida) if corrida is not None else ([], [], 0)
    herramienta_mal += [x for x in (fallo_pruebas,) if x]
    with open(log, 'a', encoding='utf-8') as f:
        f.write('\nPruebas de la pagina (pruebas/correr.py, salida %s):\n%s\n' % (rc_p, salida_p))

    # El pedido a ADVAPP se arma solo con los datos del dia
    # (herramientas/pedido-advapp.py). Se avisa cuando aparece algo que todavia
    # no se les pidio, cuando vuelve algo que habian arreglado, cuando hay
    # filas que esperan un codigo nuestro, y cuando no se pudo armar.
    rq = correr(exe, [os.path.join('herramientas', 'pedido-advapp.py')], env)
    salida_q = (rq.stdout or '') + (rq.stderr or '')
    with open(log, 'a', encoding='utf-8') as f:
        f.write('\nPedido a ADVAPP (herramientas/pedido-advapp.py, salida %s):\n%s\n'
                % (rq.returncode, salida_q))
    pedido_mal, fallo_pedido, pedido_caido = analizar_pedido(salida_q, rq.returncode)
    if caida:
        pedido_mal = []           # se calcularia sobre la planilla: ese dia no
    herramienta_mal += [x for x in (fallo_pedido,) if x]
    if pedido_caido and not caida and not sin_internet:
        # validar alcanzo a bajar ADVAPP y el pedido no: se cayo en el medio
        caida.append('[ADVAPP] NO CONTESTO al armar el pedido: no se armo (mirar el log)')

    # Las autopruebas de las herramientas (--probar: casos armados a mano, sin
    # red, un par de segundos). Si una regla del pedido deja de ver su caso, o
    # esta revision deja de leer una salida, se avisa aca y no el dia que se
    # necesitaba (29/09: asi se habian quedado ciegas sin que nadie lo note).
    for args in ([os.path.join('herramientas', 'pedido-advapp.py'), '--probar'],
                 # 29/09 (7.1 a 7.4): el que decide que falla es nueva y que ya se pidio
                 [os.path.join('herramientas', 'fallas-conocidas.py'), '--probar'],
                 # 29/09 (4.2): las paginas de la vista previa para WhatsApp
                 [os.path.join('herramientas', 'vista-previa.py'), '--probar'],
                 ['revision-diaria.py', '--probar']):
        try:
            ra = correr(exe, args, env, timeout=120)
            salida_a, rc_a = (ra.stdout or '') + (ra.stderr or ''), ra.returncode
        except subprocess.TimeoutExpired:
            salida_a, rc_a = 'se colgo', None
        with open(log, 'a', encoding='utf-8') as f:
            f.write('\nAutoprueba %s (salida %s):\n%s\n' % (' '.join(args), rc_a, salida_a))
        if rc_a != 0:
            malas = [l.strip() for l in salida_a.split('\n') if l.startswith('FALLA')]
            herramienta_mal.append('[herramienta] %s --probar falla: %s' % (
                os.path.basename(args[0]), (malas[0] if malas else ultimo_error(salida_a) or 'mirar el log')[:140]))

    # reclamar (7.3 C): un dia sin nada nuevo, lo pedido hace mas de
    # DIAS_RECLAMO dias alcanza para dejar el aviso. Las conocidas recientes no.
    # (29/09, revision) Las filas sin vista previa son un AVISO, no un error
    # (como en la guarda del navegador, decision-vista-previa.js): se arreglan
    # solas con el proximo PUBLICAR. Hasta hoy una sola fila nueva dejaba "EL
    # CATALOGO TIENE ERRORES" en el Escritorio todos los dias hasta publicar.
    # Si no se pudieron mirar, eso si es una herramienta caida.
    vista_mal, vista_aviso = separar_avisos(sin_vista)
    herramienta_mal += vista_mal
    if (r.returncode == 1 and graves) or vieja or fotos_mal or pagina_mal or colores_mal \
            or pedido_mal or herramienta_mal or caida or vaciados or reclamar:
        # En Mac, corriendo desde launchd, el sistema puede no dejar escribir
        # en el Escritorio (permisos de privacidad). Entonces el aviso queda
        # en logs/ (que no se publica) y la notificacion igual sale.
        aviso = AVISO
        try:
            open(aviso, 'a').close()
        except OSError:
            aviso = os.path.join(LOGS, os.path.basename(AVISO))
        encabezado = ('ADVAPP NO CONTESTA: la web esta mostrando la planilla\n'
                      'congelada del 22/09, y lo de abajo se reviso sobre ella.\n\n'
                      if respaldo else
                      'Son cosas que el cliente esta viendo mal en la web AHORA,\n'
                      'porque el sitio lee ADVAPP en vivo.\n\n')
        with open(aviso, 'w', encoding='utf-8') as f:
            f.write(
                'EL CATALOGO TIENE ERRORES\n'
                'Revisado el %s\n%s\n\n'
                '%s'
                '%s\n\n%s\n\n%s'
                # 29/09: validar.py marcaba sus graves [planilla] y aca se
                # traducia; ahora los marca [ADVAPP], y su pedido sale con
                # validar.py --pedido (las reglas de datos que el pedido de
                # herramientas/pedido-advapp.py todavia no tiene).
                'Cada linea dice donde se arregla:\n'
                '  ADVAPP   = se le pide a ADVAPP (PEDIDO-ADVAPP.txt; lo que marca\n'
                '             validar.py sale con: python3 validar.py --pedido)\n'
                '  nuestro  = lo resolvemos nosotros (PENDIENTES-NUESTROS.txt)\n'
                '  pagina   = lo que ve el cliente, segun las pruebas\n'
                '  codigo   = hay que tocar index.html\n'
                '  colores  = colores nuevos sin puntito en la web\n'
                '  fotos    = falta producir la imagen, o correr el comando\n'
                '             que dice REVISAR-FOTOS.txt\n'
                '  herramienta = no se pudo revisar: mirar el log (lo que\n'
                '             esa herramienta controla hoy NO se controlo)\n'
                '  publicar = se arregla solo abriendo PUBLICAR\n\n'
                'El detalle completo esta en:\n%s\n\n'
                'Cuando se resuelvan, este archivo desaparece solo\n'
                'en la revision del dia siguiente.\n'
                % (ahora, '=' * 60, encabezado,
                   '\n'.join(caida + herramienta_mal + graves
                             + (['[ADVAPP] LOS PRECIOS NO SE ACTUALIZARON: ' + vieja] if vieja else [])
                             + vaciados + fotos_mal + pagina_mal + reclamar + colores_mal + pedido_mal),
                   '=' * 60,
                   # 7.3 C: las conocidas recientes, solo con el numero
                   (('Ademas hay %d conocida(s) pedidas hace %d dias o menos.\n'
                     'El detalle: pruebas/conocidas.json\n\n' % (recientes, DIAS_RECLAMO)) if recientes else '')
                   + (('Avisos (no son errores):\n%s\n\n' % '\n'.join(vista_aviso)) if vista_aviso else ''),
                   log))
        notificar('Catalogo Advance Tecno',
                  ('ADVAPP no contesta: la web muestra la planilla del 22/09. ' if caida else '')
                  + ('Alguna revision no pudo correr. ' if herramienta_mal else '')
                  + ('%d error(es) grave(s) en los datos. ' % len(graves) if graves else '')
                  + ('ADVAPP no cargo precios hoy. ' if vieja else '')
                  + ('ADVAPP dejo un rubro sin nada para vender. ' if vaciados else '')
                  # 7.3 C (29/09): solo lo nuevo, y lo pedido hace mas de
                  # DIAS_RECLAMO dias. La Mac corta el texto largo: va primero.
                  + ('%d falla(s) NUEVAS en la pagina. ' % n_nuevas if pagina_mal else '')
                  + ''.join(x + ' ' for x in frases_reclamo)
                  + ('Hay colores nuevos sin puntito. ' if colores_mal else '')
                  + ('Hay cosas para pedirle a ADVAPP. ' if pedido_mal else '')
                  + ('Hay fotos que mirar. ' if fotos_mal else '')
                  # (29/09, revision) las filas sin vista previa no van: son
                  # un aviso (quedan en el archivo, abajo, y en el log)
                  + ('Mira el aviso en el Escritorio.' if aviso == AVISO
                     else 'Mira el aviso en la carpeta logs del catalogo.'))
        print('%d graves%s%s%s%s%s%s. Aviso dejado en %s'
              % (len(graves), ' + ADVAPP caido' if caida else '', ' + carga vieja' if vieja else '',
                 ' + fotos' if fotos_mal else '', ' + %d falla(s) nuevas en la pagina' % n_nuevas if pagina_mal else '',
                 ' + reclamar lo pedido hace mas de %d dias' % DIAS_RECLAMO if reclamar else '',
                 ' + %d herramienta(s) que no corrieron' % len(herramienta_mal) if herramienta_mal else '',
                 aviso))
        return 1

    for x in vista_aviso:
        print('Aviso (no es un error): %s' % x)
    if r.returncode == 2:
        print('No se pudo revisar (sin internet). Queda anotado en el log.')
        return 0     # no alarmamos por un problema de conexión

    viejos = [a for a in (AVISO, os.path.join(LOGS, os.path.basename(AVISO)))
              if os.path.exists(a)]
    if viejos:
        for a in viejos:
            os.remove(a)
        print('Sin errores graves. Se borró el aviso.')
    else:
        print('Sin errores graves.')
    return 0


def probar():
    """Salidas armadas a mano de cada herramienta, sin red: que la revision
    se entere de lo que antes quedaba callado."""
    import tempfile
    fallas = []

    def ok(c, txt):
        print(('  OK  ' if c else 'FALLA ') + txt)
        if not c:
            fallas.append(txt)

    tb = ('Traceback (most recent call last):\n  File "x.py", line 1\n'
          'catalogo_maestro.CatalogoRoto: catalogo-maestro.csv: 1 fila(s) sin CODIGO_VAR (línea 3).\n')
    g, resp, f = analizar_validar('Fuente: ADVAPP\n' + tb, 1)
    ok(not g and 'CatalogoRoto' in f, 'validar que revienta con 1 y sin graves es una herramienta caida')
    g, resp, f = analizar_validar('╔══\n║ 1 ERRORES GRAVES\n╚══\n  [ADVAPP  ] X  algo\n\n  Se arreglan en: x\n', 1)
    ok(g == ['  [ADVAPP  ] X  algo'] and not f, 'los graves se siguen leyendo igual (con la etiqueta ADVAPP)')
    g, resp, f = analizar_validar('Fuente: planilla\nFUENTE-RESPALDO: ADVAPP no contesto (404).\n', 0)
    ok(resp.startswith('FUENTE-RESPALDO') and not f, 'validar sobre la planilla de respaldo se reconoce')

    fm, f = analizar_fotos('     0  MISMA FOTO  <-- mirar\nLAS COLUMNAS DE LA PLANILLA NO COINCIDEN CON EL CATALOGO\n'
                           '   choque: A\n   choque: B\n   celda corrida: C\n', 1)
    ok(fm and '3 diferencia' in fm[0] and not f, 'los choques de CODIGO avisan aunque ningun contador <-- lo diga')
    # 29/09: la columna CODIGO que apunta a otro producto trae su contador
    # '<--', y la otra memoria del mismo modelo (aceptada) no tiene que avisar
    fm, f = analizar_fotos('    11  COLUMNAS DE ADVAPP QUE NO CIERRAN con el catalogo  <-- pedirlo a ADVAPP\n'
                           '    40  codigos de otra memoria del mismo modelo (aceptado, Pedro 26/09)\n'
                           'LAS COLUMNAS DE LA PLANILLA NO COINCIDEN CON EL CATALOGO\n   choque: A\n', 1)
    ok(fm == ['[fotos] 11 COLUMNAS DE ADVAPP QUE NO CIERRAN con el catalogo'] and not f,
       'las columnas de ADVAPP que apuntan a otro producto llegan al aviso por su contador')
    fm, f = analizar_fotos('     0  COLUMNAS DE ADVAPP QUE NO CIERRAN con el catalogo  <-- pedirlo a ADVAPP\n'
                           '    40  codigos de otra memoria del mismo modelo (aceptado, Pedro 26/09)\n', 0)
    ok(not fm and not f, 'la otra memoria del mismo modelo (aceptada) no avisa')
    fm, f = analizar_fotos('     0  MISMA FOTO  <-- mirar\n' + tb, 1)
    ok(not fm and 'CatalogoRoto' in f, 'verificar-fotos que revienta es una herramienta caida')
    fm, f = analizar_fotos('     2  MISMA FOTO en modelos distintos  <-- mirar primero\n', 1)
    ok(fm == ['[fotos] 2 MISMA FOTO en modelos distintos'] and not f, 'los contadores <-- se siguen leyendo igual')
    # 29/09: la salida real de verificar-fotos sin red (proxy muerto). Antes
    # cada dia sin conexion terminaba en AVISO y notificacion por esto.
    sin_red = ('AVISO: ADVAPP no contesto (<urlopen error [Errno 61] Connection refused>); se usa la '
               'planilla, congelada desde el 22/09.\n'
               'ERROR: no se pudo bajar la planilla (<urlopen error [Errno 61] Connection refused>)\n')
    fm, f = analizar_fotos(sin_red, 1, sin_internet=True)
    ok(not fm and not f, 'sin internet verificar-fotos no es una herramienta rota')
    fm, f = analizar_fotos(sin_red, 1)
    ok(not fm and 'no se pudo bajar la planilla' in f,
       'si validar si bajo los datos y verificar-fotos no, es un fallo y dice por que')
    fm, f = analizar_fotos('     0  MISMA FOTO  <-- mirar\n' + tb, 1, sin_internet=True)
    ok(not fm and 'CatalogoRoto' in f, 'sin internet, un Traceback de verificar-fotos igual avisa')

    pm, f = analizar_pruebas('  codigos        1 FALLA(S)\n       EXCEPCION: TypeError: x is null\n', 1)
    ok(pm == ['[pagina] EXCEPCION: TypeError: x is null'] and not f, 'una tanda que revienta llega al aviso')
    pm, f = analizar_pruebas('  sim            NO LLEGO A CORRER\n  meta           NO LLEGO A CORRER\n', 1)
    ok(pm == ['[pagina] 2 tanda(s) no llegaron a correr: sim, meta'], 'las tandas que no llegaron a correr se cuentan')
    pm, f = analizar_pruebas('  sim            NO LLEGO A CORRER\n', 1, sin_internet=True)
    ok(not pm and not f, 'sin internet no se alarma por las tandas que no corrieron')
    pm, f = analizar_pruebas('No encontre Chrome ni Edge. Las pruebas necesitan uno de los dos.\n', 2)
    ok(not pm and 'Chrome' in f, 'sin Chrome es una herramienta que no pudo correr')
    pm, f = analizar_pruebas('las pruebas tardaron mas de 15 minutos y se cortaron', None)
    ok('15 minutos' in f, 'el corte por tiempo se avisa')
    pm, f = analizar_pruebas('  meta           1 FALLA(S)\n       FALLA el sello  [x]\n', 1)
    ok(pm == ['[pagina] el sello  [x]'] and not f, 'las FALLA se siguen leyendo igual')

    # 29/09 (7.3 C): con la clasificacion de correr.py --json, lo del 29/09
    comp = 'la columna CODIGO nunca apunta a otro producto (otra Sim, otro teclado u otro modelo)'
    fila = lambda i, d: {'tipo': 'fila', 'tanda': 'codigos', 'comprobacion': comp, 'id': i, 'detalle': d,
                         'nombre': '', 'nota': '', 'clave': 'codigos|columna-codigo-nunca-apunta|' + i}
    conocida = lambda i, g, f: {'id': i, 'grupo': g, 'a': 'ADVAPP', 'fecha': f}
    corrida = {'nuevas': [fila('NBK-APL-MBA13M5-24G512-MID-EN', 'lleva AT-0522'),
                          fila('NBK-APL-MBA13M5-24G512-SKY-EN', 'lleva AT-0522'),
                          fila('CEL-APL-17P-256-ORG-SIM', 'lleva AT-0071')],
               'conocidas': [conocida('NBK-APL-NEO13-8G256-BLS-ES', 'MacBook Neo 8/256 teclado ES', '2026-09-21'),
                             conocida('NBK-APL-NEO13-8G256-IND-ES', 'MacBook Neo 8/256 teclado ES', '2026-09-21'),
                             conocida('CEL-APL-17P-1TB-BLU-SIM', 'iPhone 17 Pro Sim', '2026-09-26'),
                             conocida('X-1', 'Otro', '2026-09-22')]}
    pm, f = analizar_pruebas('  codigos        2 FALLA(S)\n       FALLA %s  [3: ...]\n' % comp, 1, corrida=corrida)
    ok(len(pm) == 1 and pm[0].startswith('[pagina] NUEVA: la columna CODIGO') and not f
       and '\n         CEL-APL-17P-256-ORG-SIM: lleva AT-0071' in pm[0] and pm[0].count('\n') == 3,
       'las nuevas llegan con cada ID en su linea, sin el corte a 160 (el tercer ID ya no queda en "AT-00")')
    ok(contar_nuevas(corrida) == 3, 'y se cuentan por fila, como en correr.py')
    lineas, frases, recientes = reclamos(corrida, datetime.date(2026, 9, 29))
    ok(len(lineas) == 1 and lineas[0].startswith('[ADVAPP] RECLAMAR: 2 fila(s) pedidas el 21/09 siguen igual (8 dias)')
       and '         MacBook Neo 8/256 teclado ES (2)' in lineas[0] and recientes == 2,
       'lo pedido hace mas de %d dias se reclama, agrupado; lo de 7 dias justos (22/09) todavia no' % DIAS_RECLAMO)
    ok(frases == ['Reclamar a ADVAPP: 2 fila(s) pedidas hace 8 dias.'], 'la notificacion dice "Reclamar a ADVAPP"')
    lineas, frases, recientes = reclamos({'nuevas': [], 'conocidas': corrida['conocidas'][2:]},
                                         datetime.date(2026, 9, 29))
    ok(not lineas and not frases and recientes == 2, 'con solo conocidas recientes no hay reclamo (ni aviso)')
    pm, f = analizar_pruebas('RESULTADO: nada nuevo. 4 conocidas siguen\n', 3,
                             corrida={'nuevas': [], 'conocidas': corrida['conocidas']})
    ok(not pm and not f, 'un dia sin nuevas (correr.py sale con 3) no es "terminaron mal" ni una falla')
    pm, f = analizar_pruebas('       FALLA %s  [x]\n' % comp, 3)
    ok(pm and not f, 'sin el JSON de correr.py, todo cuenta como nuevo (como antes)')
    pm, f = analizar_pruebas('  sim            NO LLEGO A CORRER\n',
                             1, corrida={'nuevas': [{'tipo': 'no_corrio', 'tanda': 'sim', 'comprobacion': 'NO LLEGO A CORRER'}]})
    ok(pm == ['[pagina] 1 tanda(s) no llegaron a correr: sim'], 'con el JSON, las que no corrieron van en su linea de siempre')

    # (29/09, revision) La salida de correr.py --detalle de la corrida del 9821
    # (acortada la lista de codigos): la tanda caida sale arriba y en NUEVAS.
    real = ('Corriendo 51 tandas con los datos de hoy\n(http://localhost:9821)...\n\n'
            '  agrupacion     ===== TODO OK =====\n'
            '  codigos        ===== 2 FALLA(S) =====\n'
            '       FALLA y todas las portadas usan una de esas  [SWT-APL-WULTRA3-000-BLK-49-CELL-OCEAN -> '
            '1huLIXmTEPy9bEyBMCkLlWQFLU-Lpuy0F=w400]\n'
            '       FALLA %s  [11: CEL-APL-17P-1TB-BLU-SIM (Sim/-) lleva AT-0071, que es E-Sim/- '
            '(CEL-APL-17P-1TB-BLU-ESIM) | ...]\n'
            '  guardas-b6-portada NO LLEGO A CORRER\n'
            '       (la pagina cargo pero la tanda no escribio\n'
            '       su RESULTADO)\n\n'
            '  ================================================\n'
            '   1 NUEVA - frena la publicacion\n'
            '  ================================================\n'
            '  guardas-b6-portada | NO LLEGO A CORRER\n'
            '   (la pagina cargo pero la tanda no escribio su\n'
            '     RESULTADO). No se anota: se vuelve a correr.\n'
            '  ------------------------------------------------\n'
            '   12 CONOCIDAS - ya pedidas, no frenan\n'
            '  ------------------------------------------------\n\n'
            'RESULTADO: 1 NUEVA. Revisar antes de publicar.\n'
            '           12 conocidas siguen esperando\n'
            '           respuesta.\n') % comp
    caida = {'nuevas': [{'tipo': 'no_corrio', 'tanda': 'guardas-b6-portada', 'comprobacion': 'NO LLEGO A CORRER',
                         'id': '', 'detalle': 'la pagina cargo pero la tanda no escribio su RESULTADO'}],
             'conocidas': corrida['conocidas']}
    pm, f = analizar_pruebas(real, 1, corrida=caida)
    ok(pm == ['[pagina] 1 tanda(s) no llegaron a correr: guardas-b6-portada'] and not f
       and contar_nuevas(caida) == 1,
       'con el JSON, la tanda caida (arriba y en NUEVAS) cuenta una vez, igual que en la notificacion')
    pm, f = analizar_pruebas(real, 1)
    ok([x for x in pm if 'no llegaron' in x] == ['[pagina] 1 tanda(s) no llegaron a correr: guardas-b6-portada'],
       'sin el JSON tambien: la linea de NUEVAS (con "|") no se cuenta otra vez')

    # (29/09, revision) contar_nuevas es la de fallas-conocidas.py, no una copia
    fc = clasificador()
    ok(fc is not None, 'se carga herramientas/fallas-conocidas.py para contar las nuevas')
    if fc is not None:
        salidas = [corrida['nuevas'], caida['nuevas'],
                   corrida['nuevas'] + [{'tipo': 'no_se_ven', 'cuantas': 7}, {'tipo': 'no_se_ven', 'cuantas': None},
                                        {'tipo': 'excepcion'}, {'tipo': 'sin_filas'}] + caida['nuevas'], []]
        ok(all(contar_nuevas({'nuevas': n}) == fc.contar_nuevas(n) for n in salidas)
           and contar_nuevas({'nuevas': salidas[2]}) == 3 + 7 + 1 + 1 + 1 + 1,
           'cuenta igual que correr.py: cada fila una, y lo que no se ve, las que faltan')
        ok(contar_nuevas({'nuevas': salidas[2]}, sin_internet=True) == fc.contar_nuevas(salidas[2]) - 1,
           'sin internet no cuentan las tandas que no corrieron')

    ok(analizar_pedido('Pendientes nuestros: 3 (codigos: 1, colores sin registrar: 2) (en P)\n'
                       'Pedido a ADVAPP: 10 puntos (2 nuevos, 8 ya pedidos), 0 arreglados.\nVolvieron: 1\n', 1)[0]
       == ['[ADVAPP] 2 punto(s) nuevos para pedirles  ->  PEDIDO-ADVAPP.txt (cuando se mande: pedido-advapp.py --enviado)',
           '[ADVAPP] 1 punto(s) que habian arreglado volvieron  ->  PEDIDO-ADVAPP.txt',
           '[nuestro] 1 fila(s) esperan que les demos codigo; 2 color(es) nuevo(s) sin registrar en el maestro '
           '(sin eso no hay foto)  ->  PENDIENTES-NUESTROS.txt'],
       'el pedido: nuevos, los que volvieron y los pendientes nuestros')
    pm, f, c = analizar_pedido('REGISTRO DANADO: pedidos-advapp.json no se puede leer (x).\n', 2)
    ok(not pm and 'REGISTRO DANADO' in f and not c, 'el registro danado es una herramienta que no pudo correr')
    pm, f, c = analizar_pedido('ADVAPP no contesto (HTTP Error 404): no se arma el pedido.\n', 2)
    ok(not pm and not f and c, 'ADVAPP caido en el pedido no es una herramienta rota: es la caida')

    tmp = tempfile.mkdtemp(prefix='revision-probar-')
    viejo = (datetime.date.today() - datetime.timedelta(days=DIAS_LOG + 2)).isoformat()
    nuevo = datetime.date.today().isoformat()
    for n in ('revision-%s.txt' % viejo, 'advapp-%s.json' % viejo, 'revision-%s.txt' % nuevo,
              'advapp-%s.json' % nuevo, 'advapp-ultima-carga.json',
              'pruebas-%s.json' % viejo, 'pruebas-%s.json' % nuevo):
        open(os.path.join(tmp, n), 'w').close()
    limpiar_logs_viejos(tmp)
    ok(sorted(os.listdir(tmp)) == sorted(['revision-%s.txt' % nuevo, 'advapp-%s.json' % nuevo,
                                          'advapp-ultima-carga.json', 'pruebas-%s.json' % nuevo]),
       'se borran los logs, las copias y las clasificaciones de las pruebas viejas, y nada mas')
    global LOGS
    viejo_logs, LOGS = LOGS, tmp
    try:
        e = estado_advapp(nuevo, intentos=2, espera=0, url='file://' + os.path.join(tmp, 'no-existe.json'))
        ok(e['caido'] and not e['copia'], 'ADVAPP que no contesta se reintenta y queda como caido')
        with open(os.path.join(tmp, 'corto.json'), 'w') as fh:
            fh.write('{"filas": 10, "productos": [{"ID": "A"}]}')
        e = estado_advapp(nuevo, intentos=1, espera=0, url='file://' + os.path.join(tmp, 'corto.json'))
        ok(e['caido'] and 'trajo 1 de las 10' in e['caido'], 'una carga cortada cuenta como caida')
        with open(os.path.join(tmp, 'bien.json'), 'w') as fh:
            fh.write('{"filas": 1, "generado_en": "g", "productos": [{"ID": "A"}]}')
        e = estado_advapp(nuevo, intentos=1, espera=0, url='file://' + os.path.join(tmp, 'bien.json'))
        ok(not e['caido'] and e['copia'] and os.path.exists(e['copia']) and 'generado_en g' in e['dato'],
           'la carga buena se guarda en logs/ y anota generado_en')
    finally:
        LOGS = viejo_logs

    # Un rubro entero fuera de venta de un dia para el otro (el 28/09, los Objetivos)
    tmp2 = tempfile.mkdtemp(prefix='revision-rubros-')
    import json
    fila = lambda cat, stock, precio='100', activo='Sí': {'Categoría': cat, 'Stock': stock,
                                                          'Precio USD': precio, 'Activo': activo}
    with open(os.path.join(tmp2, 'advapp-2026-09-27.json'), 'w', encoding='utf-8') as fh:
        json.dump({'productos': [fila('Lente', 'Sí'), fila('Lente', 'No'), fila('Celular', 'Sí'),
                                 fila('Drone', 'No')]}, fh)
    hoy_json = os.path.join(tmp2, 'advapp-2026-09-28.json')
    with open(hoy_json, 'w', encoding='utf-8') as fh:
        json.dump({'productos': [fila('Lente', 'Sí', '0'), fila('Lente', 'Sí', '100', 'No'),
                                 fila('Celular', 'Sí'), fila('Drone', 'No')]}, fh)
    v = rubros_que_se_vaciaron(hoy_json, tmp2)
    ok(len(v) == 1 and '"Lente"' in v[0] and '2026-09-27' in v[0] and v[0].startswith('[ADVAPP]'),
       'un rubro que ayer tenia para vender y hoy nada (sin precio o inactivo) se avisa como dato de ADVAPP')
    ok(rubros_que_se_vaciaron(os.path.join(tmp2, 'advapp-2026-09-27.json'), tmp2) == [],
       'sin copia anterior no se avisa nada')

    # Las filas nuevas sin vista previa para WhatsApp (decision 4.2, 29/09)
    p_dir = os.path.join(tmp2, 'p')
    os.makedirs(p_dir)
    fv = lambda i, activo='Sí', desc='X': {'ID': i, 'Activo': activo, 'Descripción completa': desc}
    with open(hoy_json, 'w', encoding='utf-8') as fh:
        json.dump({'productos': [fv('A-1'), fv('A-2'), fv('A-3'), fv('A-4', 'No'), fv('A-5', desc='')]}, fh)
    with open(os.path.join(p_dir, 'indice.json'), 'w', encoding='utf-8') as fh:
        json.dump({'ids': ['A-1', 'A-9']}, fh)
    # (29/09, revision) al lado queda _generado.json (con que se armaron las
    # paginas): no cambia que filas tienen la suya
    with open(os.path.join(p_dir, '_generado.json'), 'w', encoding='utf-8') as fh:
        json.dump({'generado_en': 'g', 'vistas': {'A-2': {'titulo': 'x', 'linea': '', 'foto': '', 'destino': 'A-2'}}}, fh)
    v = filas_sin_vista_previa(hoy_json, p_dir)
    ok(len(v) == 1 and v[0].startswith('[publicar] 2 fila(s)') and 'A-2, A-3' in v[0] and 'A-4' not in v[0]
       and 'A-5' not in v[0], 'las filas nuevas sin pagina se avisan; las inactivas y sin nombre no')
    # (29/09, revision) y son un aviso, no un error: solas no dejan "EL
    # CATALOGO TIENE ERRORES" (se arreglan con el proximo PUBLICAR)
    errores, avisos = separar_avisos(v)
    ok(errores == [] and avisos == v, 'las filas sin vista previa son un aviso, no un error del catalogo')
    roto = '[herramienta] no se pudieron mirar las vistas previas: x'
    ok(separar_avisos(v + [roto]) == ([roto], v), 'pero no poder mirarlas si es un error (una herramienta caida)')
    with open(os.path.join(p_dir, 'indice.json'), 'w', encoding='utf-8') as fh:
        json.dump({'ids': ['A-1', 'A-2', 'A-3']}, fh)
    ok(filas_sin_vista_previa(hoy_json, p_dir) == [], 'con todas las paginas hechas no se avisa nada')
    ok(filas_sin_vista_previa(os.path.join(tmp2, 'no-esta.json'), p_dir) == [],
       'sin copia de ADVAPP no se avisa nada')
    import shutil
    shutil.rmtree(tmp2, ignore_errors=True)
    print()
    print('RESULTADO: %s' % ('%d FALLA(S)' % len(fallas) if fallas else 'pasa todo'))
    return 1 if fallas else 0


if __name__ == '__main__':
    sys.exit(main())
