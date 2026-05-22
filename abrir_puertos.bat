@echo off
netsh advfirewall firewall add rule name="NeoAssistence Frontend" dir=in protocol=tcp localport=3000 action=allow
netsh advfirewall firewall add rule name="NeoAssistence Backend" dir=in protocol=tcp localport=8000 action=allow
echo Puertos abiertos. Presiona cualquier tecla para salir.
pause
