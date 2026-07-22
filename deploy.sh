#!/bin/bash
# Skorch deployment script - NEVER deletes the database
# Usage: bash deploy.sh

HOST="u1045-zotpfpmgzcoh@ssh.skorchthegame.com"
PORT="18765"
REMOTE_PATH="~/www/play.skorchthegame.com/public_html"
LOCAL_PATH="$(dirname "$0")"

echo "=== Skorch Deploy ==="

# 1. Backup database first
echo "Backing up database..."
mkdir -p "$LOCAL_PATH/server/php/db-backups"
ssh -p $PORT $HOST "cat $REMOTE_PATH/server/php/db/skorch.db" > "$LOCAL_PATH/server/php/db-backups/skorch-$(date +%Y%m%d-%H%M%S).db"
echo "Database backed up locally"

# 2. Deploy frontend (CSS, JS, HTML, pages, assets) - safe to delete and replace
echo "Deploying frontend..."
ssh -p $PORT $HOST "rm -rf $REMOTE_PATH/css $REMOTE_PATH/js"
scp -P $PORT -r "$LOCAL_PATH/css" "$LOCAL_PATH/js" "$LOCAL_PATH/index.html" $HOST:$REMOTE_PATH/

# Deploy sub-pages
echo "Deploying pages..."
ssh -p $PORT $HOST "mkdir -p $REMOTE_PATH/play $REMOTE_PATH/leaderboard $REMOTE_PATH/profile $REMOTE_PATH/rules $REMOTE_PATH/login $REMOTE_PATH/register $REMOTE_PATH/friends $REMOTE_PATH/clans $REMOTE_PATH/admin $REMOTE_PATH/assets"
scp -P $PORT "$LOCAL_PATH/play/index.html" $HOST:$REMOTE_PATH/play/
scp -P $PORT "$LOCAL_PATH/leaderboard/index.html" $HOST:$REMOTE_PATH/leaderboard/
scp -P $PORT "$LOCAL_PATH/friends/index.html" $HOST:$REMOTE_PATH/friends/
scp -P $PORT "$LOCAL_PATH/clans/index.html" $HOST:$REMOTE_PATH/clans/
scp -P $PORT "$LOCAL_PATH/admin/index.html" $HOST:$REMOTE_PATH/admin/
scp -P $PORT "$LOCAL_PATH/profile/index.html" $HOST:$REMOTE_PATH/profile/
ssh -p $PORT $HOST "mkdir -p $REMOTE_PATH/profile/edit"
scp -P $PORT "$LOCAL_PATH/profile/edit/index.html" $HOST:$REMOTE_PATH/profile/edit/
scp -P $PORT "$LOCAL_PATH/rules/index.html" $HOST:$REMOTE_PATH/rules/
scp -P $PORT "$LOCAL_PATH/login/index.html" $HOST:$REMOTE_PATH/login/
scp -P $PORT "$LOCAL_PATH/register/index.html" $HOST:$REMOTE_PATH/register/
ssh -p $PORT $HOST "mkdir -p $REMOTE_PATH/forgot-password"
scp -P $PORT "$LOCAL_PATH/forgot-password/index.html" $HOST:$REMOTE_PATH/forgot-password/
scp -P $PORT -r "$LOCAL_PATH/assets/"* $HOST:$REMOTE_PATH/assets/

# 3. Cache bypass for client.js
ssh -p $PORT $HOST "cp $REMOTE_PATH/js/multiplayer/client.js $REMOTE_PATH/js/multiplayer/client2.js && sed -i 's|multiplayer/client.js|multiplayer/client2.js|g' $REMOTE_PATH/js/main.js"

# 4. Deploy PHP API files ONLY (NOT the db folder)
echo "Deploying PHP API..."
ssh -p $PORT $HOST "mkdir -p $REMOTE_PATH/server/php/api $REMOTE_PATH/server/php/middleware $REMOTE_PATH/server/php/db"
scp -P $PORT "$LOCAL_PATH/server/php/config.php" $HOST:$REMOTE_PATH/server/php/
scp -P $PORT "$LOCAL_PATH/server/php/init.php" $HOST:$REMOTE_PATH/server/php/
scp -P $PORT -r "$LOCAL_PATH/server/php/api/"* $HOST:$REMOTE_PATH/server/php/api/
scp -P $PORT -r "$LOCAL_PATH/server/php/middleware/"* $HOST:$REMOTE_PATH/server/php/middleware/
# Deploy .htaccess for db protection
scp -P $PORT "$LOCAL_PATH/server/php/db/.htaccess" $HOST:$REMOTE_PATH/server/php/db/

echo "=== Deploy complete ==="
