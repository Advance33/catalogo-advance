# -*- coding: utf-8 -*-
"""
Revisión automática del catálogo, una vez por día.

El sitio lee la planilla EN VIVO: si el parser rompe algo un martes, está
roto en la web hasta que alguien lo note, aunque no se publique nada. Esto
mira la planilla todos los días y avisa solo cuando hay algo grave.

Cómo avisa:
  - Siempre deja el detalle en logs\\revision-AAAA-MM-DD.txt
  - Si hay errores graves, pone un archivo bien visible en el Escritorio
    y muestra una notificación.
  - Cuando los errores se resuelven, el archivo del Escritorio se borra solo.

Se instala con instalar-revision-diaria.bat (una sola vez).
Para probarlo a mano:  python revision-diaria.py
"""
import os, sys, subprocess, datetime, glob

AQUI      = os.path.dirname(os.path.abspath(__file__))
LOGS      = os.path.join(AQUI, 'logs')
ESCRITORIO = os.path.join(os.environ.get('USERPROFILE', AQUI), 'Desktop')
AVISO     = os.path.join(ESCRITORIO, 'AVISO - catalogo con errores.txt')
DIAS_LOG  = 30
TAREA     = 'Catalogo Advance Tecno - revision diaria'
HORA_DEF  = '09:30'


def correr_ps(comando):
    return subprocess.run(['powershell', '-NoProfile', '-Command', comando],
                          capture_output=True, text=True, encoding='utf-8', errors='replace')


def instalar(hora):
    """Registra la tarea programada de Windows. No hace falta ser admin:
    es una tarea del usuario."""
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
        '-Description "Revisa la planilla del catalogo y avisa si hay errores graves." '
        '-Force | Out-Null;'
        '"ok"'
    ) % (pythonw, AQUI, hora, TAREA)

    r = correr_ps(ps)
    if r.returncode == 0 and 'ok' in (r.stdout or ''):
        print('Listo. La revisión va a correr todos los días a las %s.' % hora)
        print('Si la máquina estaba apagada a esa hora, corre cuando la prendas.')
        print('\nPara cambiar la hora:   python revision-diaria.py --instalar 14:00')
        print('Para sacarla:           python revision-diaria.py --desinstalar')
        return 0
    print('No se pudo registrar la tarea:\n%s' % ((r.stderr or r.stdout or '').strip()[:600]))
    return 1


def desinstalar():
    r = correr_ps('Unregister-ScheduledTask -TaskName "%s" -Confirm:$false; "ok"' % TAREA)
    if 'ok' in (r.stdout or ''):
        print('Tarea eliminada. Ya no se revisa sola.')
        return 0
    print('No estaba instalada, o no se pudo sacar.')
    return 1


def estado():
    r = correr_ps(
        '$t = Get-ScheduledTask -TaskName "%s" -ErrorAction SilentlyContinue;'
        'if($t){ $i = Get-ScheduledTaskInfo $t;'
        '"Instalada. Estado: " + $t.State;'
        '"Ultima vez:  " + $i.LastRunTime;'
        '"Proxima vez: " + $i.NextRunTime } else { "No esta instalada." }' % TAREA)
    print((r.stdout or '').strip())
    return 0


def notificar(titulo, texto):
    """Globo de notificación de Windows. Si falla, no pasa nada: el aviso
    de verdad es el archivo del Escritorio."""
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


def limpiar_logs_viejos():
    corte = datetime.date.today() - datetime.timedelta(days=DIAS_LOG)
    for f in glob.glob(os.path.join(LOGS, 'revision-*.txt')):
        try:
            fecha = datetime.date.fromisoformat(os.path.basename(f)[9:19])
            if fecha < corte:
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

    r = subprocess.run([exe, 'validar.py', '--todo'],
                       cwd=AQUI, capture_output=True, text=True,
                       encoding='utf-8', errors='replace',
                       creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    salida = (r.stdout or '') + (r.stderr or '')

    log = os.path.join(LOGS, 'revision-%s.txt' % hoy)
    with open(log, 'w', encoding='utf-8') as f:
        f.write('Revisión del catálogo — %s\n%s\n\n%s' % (ahora, '=' * 60, salida))
    limpiar_logs_viejos()

    # Sólo las líneas de error grave, para el aviso
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

    if r.returncode == 1 and graves:
        with open(AVISO, 'w', encoding='utf-8') as f:
            f.write(
                'EL CATALOGO TIENE ERRORES\n'
                'Revisado el %s\n%s\n\n'
                'Son cosas que el cliente esta viendo mal en la web AHORA,\n'
                'porque el sitio lee la planilla en vivo.\n\n'
                '%s\n\n%s\n\n'
                'Cada linea dice donde se arregla:\n'
                '  planilla = se le pide al equipo del sheet\n'
                '  codigo   = hay que tocar index.html\n'
                '  fotos    = falta producir la imagen\n\n'
                'El detalle completo esta en:\n%s\n\n'
                'Cuando se resuelvan, este archivo desaparece solo\n'
                'en la revision del dia siguiente.\n'
                % (ahora, '=' * 60, '\n'.join(graves), '=' * 60, log))
        notificar('Catalogo Advance Tecno',
                  '%d error(es) grave(s) en la planilla. Mira el aviso en el Escritorio.' % len(graves))
        print('%d graves. Aviso dejado en el Escritorio.' % len(graves))
        return 1

    if r.returncode == 2:
        print('No se pudo revisar (sin internet). Queda anotado en el log.')
        return 0     # no alarmamos por un problema de conexión

    if os.path.exists(AVISO):
        os.remove(AVISO)
        print('Sin errores graves. Se borró el aviso del Escritorio.')
    else:
        print('Sin errores graves.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
