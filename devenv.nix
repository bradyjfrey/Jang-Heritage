{ pkgs, ... }:

{
  # Node 24 LTS + pnpm, scoped to this project.
  # System Node 25 (claude-code, netlify-cli) is unaffected.
  languages.javascript.enable = true;
  languages.javascript.package = pkgs.nodejs_24;
  languages.javascript.pnpm.enable = true;

  # psql client and other small CLI helpers we'll want during dev.
  packages = [
    pkgs.libpq
    pkgs.jq
  ];

  # Local Postgres 17 server. Runs only inside the devenv shell when started
  # via `devenv up`. Data lives in .devenv/state/postgres (gitignored).
  # Listens on 127.0.0.1:5433 to avoid conflict with any future system Postgres on 5432.
  services.postgres = {
    enable = true;
    package = pkgs.postgresql_17;
    listen_addresses = "127.0.0.1";
    port = 5433;
    initialDatabases = [ { name = "jang_heritage_dev"; } ];
  };

  # Banner shown when entering the shell, surfaces the most-used commands.
  enterShell = ''
    echo ""
    echo "Jang Heritage dev shell"
    echo "  node : $(node -v 2>/dev/null || echo 'unavailable')"
    echo "  pnpm : $(pnpm -v 2>/dev/null || echo 'unavailable')"
    echo "  psql : $(psql --version 2>/dev/null | head -1 || echo 'unavailable')"
    echo ""
    echo "Start services (Postgres) : devenv up"
    echo "Connect to db             : psql -h 127.0.0.1 -p 5433 -d jang_heritage_dev"
    echo ""
  '';
}
