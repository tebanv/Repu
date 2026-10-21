## Comandos Docker

# Sube los servicios definidos en el archivo YAML (-f). -d los ejecuta en segundo plano (detached). 
# --build fuerza a Docker a reconstruir las imágenes antes de levantarlas.
docker compose -f docker-compose-apps.yaml up -d --build
docker compose -f docker-compose-infra.yaml up -d --build

#  Muestra todos los contenedores existentes (los que están activos y los que se han detenido). Si usas solo docker ps verás solo los activos.
docker ps -a

# Muestra los logs de un contenedor específico. La opción -f (follow) permite ver los logs en tiempo real, muy útil para depuración.
docker logs -f <nombre_o_id>	

# Abre una sesión interactiva dentro del contenedor. El shell más común es /bin/bash o a veces /bin/sh. Es esencial para ver archivos internos.
docker exec -it <nombre_o_id> /bin/bash	

# Envía una señal de apagado ("gentle kill") a un contenedor en ejecución.
docker stop <nombre_o_id>

# Elimina un contenedor que está detenido. Si está en ejecución, usa docker rm -f <nombre_o_id> (pero es mejor usar stop primero).
docker rm <nombre_o_id>	

# Elimina una imagen de tu sistema local. Útil para liberar espacio después de construir nuevas versiones.
docker rmi <nombre_o_id_imagen>	

# Limpieza total. Elimina todos los contenedores detenidos, todas las redes no usadas, imágenes sin etiquetas y el caché de construcción. ¡Cuidado al usarlo en producción!
docker system prune -a	

# Descarga una imagen específica (ej: mysql:8.0) desde Docker Hub o un registro privado al servidor.
docker pull <imagen:tag>

# Construye una imagen Docker desde el Dockerfile en el directorio actual (.). El tag (-t) es esencial para identificar la versión.
docker build -t <nombre:tag> .	

# Detiene y elimina los contenedores, redes y volúmenes creados por el último docker-compose up. Es la forma limpia de bajar un entorno completo.
docker-compose down	

# Elimina los Volúmenes de Datos. Esta es la bandera más importante. Borra todos los volúmenes anónimos (sin nombre) creados por el up. Útil para una limpieza total y empezar con datos frescos.	
docker-compose down -v

# Elimina contenedores "huérfanos". Borra los contenedores que se crearon en una ejecución anterior de up pero que ya no están definidos en el archivo YAML actual.	
docker-compose down --remove-orphans

# -t <segundos> o --timeout <segundos>	Establece un tiempo de espera antes de forzar el apagado. Especifica la cantidad de segundos que Compose esperará después de enviar la señal SIGTERM a los contenedores antes de forzar un SIGKILL.
docker-compose down -t 10

# --rmi all	Elimina las Imágenes. Elimina las imágenes usadas por los servicios. all elimina las imágenes creadas por el build. local elimina solo las imágenes que no tienen etiqueta.	
docker-compose down --rmi all

# -f <archivo>	Especifica un archivo YAML diferente. Útil si usas múltiples archivos de configuración (por ejemplo, uno para desarrollo y otro para producción).	
docker-compose down -f docker-compose.prod.yaml

# Muestra información detallada en formato JSON sobre un contenedor, imagen, volumen o red. Útil para revisar variables de entorno o configuraciones de red.
docker inspect <nombre_o_id>	


docker-compose -f docker-compose-infra.yaml restart traefik


#########################################################################################################


# 1. Parar la app
docker stop evolution_api
docker stop n8n

# 2. Restaurar backup
cat ./backups_migration/dump_n8n.sql | docker exec -i postgres psql -U n8n postgres
cat ./backups_migration/dump_lucy.sql | docker exec -i lucy_postgres psql -U lucy lucy
cat ./backups_migration/dump_evo.sql | docker exec -i evo_postgres psql -U evolution postgres
# 3. Arrancar la app
docker start evolution_api
docker start n8n

#########################################################################################################

# Muestra una lista de todas las imágenes que tienes descargadas o construidas localmente, indicando su tamaño y etiqueta (tag).
docker images

# Muestra en tiempo real el consumo de recursos (CPU, Memoria, Red) de todos los contenedores en ejecución. Indispensable para monitorear si algún servicio (como n8n o tu API) está consumiendo demasiada RAM.

docker stats

# Copia archivos o carpetas entre tu máquina local (host) y un contenedor. Funciona en ambas direcciones, vital para extraer logs internos o subir archivos de configuración temporales.

(Host a Contenedor): docker cp ./archivo.txt <nombre_o_id>:/ruta/interna/
(Contenedor a Host): docker cp <nombre_o_id>:/ruta/interna/archivo.txt ./

docker cp <nombre_o_id>:/ruta/en/contenedor ./ruta/local

# Muestra los logs combinados de todos los servicios definidos en el archivo YAML al mismo tiempo. Muy útil para ver cómo interactúan tus microservicios en tiempo real.

docker-compose -f docker-compose-app.yaml logs -f

# Lista todos los volúmenes de datos creados por Docker. Esencial para administrar la persistencia de datos de tus bases de datos.

docker volume ls

# Elimina todos los volúmenes que no estén siendo usados por ningún contenedor. Excelente para mantenimiento, pero asegúrate de no necesitar esos datos antes de ejecutarlo.

docker volume prune

# Genera un backup (volcado) de una base de datos PostgreSQL directamente desde el contenedor hacia tu máquina local. Este es el complemento perfecto para tus comandos de restauración.

docker exec -t <nombre_contenedor_db> pg_dump -U  <nombre_db> > ./backups/dump_backup.sql

# Inspecciona una red específica de Docker para ver qué contenedores están conectados a ella y qué direcciones IP internas tienen asignadas. Útil cuando Traefik no encuentra un servicio.

docker network inspect <nombre_de_la_red>

# Pausa todos los procesos dentro de uno o varios contenedores sin detener el contenedor por completo. Útil para congelar el estado de una app.

docker pause <nombre_o_id>

# Reanuda los procesos de un contenedor que fue pausado.

docker unpause <nombre_o_id>

# Muestra los procesos internos que se están ejecutando dentro del contenedor (similar al comando 'top' de Linux, pero aislado al contenedor).

docker top <nombre_o_id>