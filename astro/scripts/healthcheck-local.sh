#!/usr/bin/env bash
set -euo pipefail

# Este check valida Apache local del servidor sin depender de DNS.
# Fuerza Host header para enrutar al vhost correcto.
HEALTHCHECK_SCHEME="${HEALTHCHECK_SCHEME:-http}"
HEALTHCHECK_DOMAIN="${HEALTHCHECK_DOMAIN:-fenicio.es}"
HEALTHCHECK_CONNECT_IP="${HEALTHCHECK_CONNECT_IP:-}"
HEALTHCHECK_APACHE_IP="${HEALTHCHECK_APACHE_IP:-}"

if [[ "$HEALTHCHECK_SCHEME" != "http" && "$HEALTHCHECK_SCHEME" != "https" ]]; then
  echo "HEALTHCHECK_SCHEME debe ser http o https"
  exit 1
fi

detect_domain_non_loopback_ip() {
  if [[ -n "$HEALTHCHECK_APACHE_IP" ]]; then
    printf '%s\n' "$HEALTHCHECK_APACHE_IP"
    return 0
  fi

  # Intenta IP local del host (sin loopback), útil cuando el dominio aún no resuelve externamente.
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i!="127.0.0.1"){print $i; exit}}')"
  if [[ -n "$ip" ]]; then
    printf '%s\n' "$ip"
    return 0
  fi

  # Fallback: resolución local del dominio si existe en /etc/hosts.
  local resolved
  resolved="$(getent ahostsv4 "$HEALTHCHECK_DOMAIN" 2>/dev/null | awk '{print $1}' | awk '!seen[$0]++')"
  if [[ -z "${resolved:-}" ]]; then
    return 1
  fi
  while IFS= read -r rip; do
    if [[ "$rip" != "127.0.0.1" ]]; then
      printf '%s\n' "$rip"
      return 0
    fi
  done <<<"$resolved"
  return 1
}

fetch_status_and_body() {
  local base_url="$1"
  local path="$2"
  local url="${base_url}${path}"
  local header_file body_file error_file curl_rc
  header_file="$(mktemp)"
  body_file="$(mktemp)"
  error_file="$(mktemp)"

  local -a curl_args=(-sS -D "$header_file" -o "$body_file" -H "Host: ${HEALTHCHECK_DOMAIN}")
  if [[ "$HEALTHCHECK_SCHEME" == "https" ]]; then
    curl_args+=(-k)
  fi
  if [[ -n "$HEALTHCHECK_CONNECT_IP" ]]; then
    if [[ "$HEALTHCHECK_SCHEME" == "https" ]]; then
      curl_args+=(--connect-to "${HEALTHCHECK_DOMAIN}:443:${HEALTHCHECK_CONNECT_IP}:443")
    else
      curl_args+=(--connect-to "${HEALTHCHECK_DOMAIN}:80:${HEALTHCHECK_CONNECT_IP}:80")
    fi
  fi

  set +e
  curl "${curl_args[@]}" "$url" 2>"$error_file"
  curl_rc=$?
  set -e
  if [[ "$curl_rc" -ne 0 ]]; then
    printf '__CURL_ERROR__\n'
    printf '%s\n' "$curl_rc"
    sed -n '1,10p' "$error_file"
    rm -f "$header_file" "$body_file" "$error_file"
    return 0
  fi

  local status body
  status="$(awk 'toupper($1) ~ /^HTTP/ {code=$2} END {print code}' "$header_file")"
  body="$(<"$body_file")"
  rm -f "$header_file" "$body_file" "$error_file"
  printf '%s\n' "$status"
  printf '%s' "$body"
}

check_route() {
  local base_url="$1"
  local path="$2"
  local response first_line status body
  echo "Healthcheck: ${base_url}${path} (Host: ${HEALTHCHECK_DOMAIN})"

  response="$(fetch_status_and_body "$base_url" "$path")"
  first_line="$(printf '%s' "$response" | sed -n '1p')"
  if [[ "$first_line" == "__CURL_ERROR__" ]]; then
    echo "Fallo curl en ${base_url}${path}: $(printf '%s' "$response" | sed '1,2d' | tr '\n' ' ')"
    return 1
  fi

  status="$first_line"
  body="$(printf '%s' "$response" | sed '1d')"
  if [[ "$status" != "200" && "$status" != "301" && "$status" != "302" ]]; then
    echo "Fallo: status HTTP inesperado ${status} en ${base_url}${path}"
    return 1
  fi

  case "$body" in
    *"Plesk service page"*|*"The webserver is alive"*)
      echo "Fallo: Apache está sirviendo la página interna de Plesk en ${base_url}${path}"
      return 1
      ;;
  esac

  return 0
}

# Comprobación local prioritaria: loopback HTTP con Host header.
if check_route "http://127.0.0.1" "/" \
  && check_route "http://127.0.0.1" "/blog/" \
  && check_route "http://127.0.0.1" "/equipo.html"; then
  echo "Healthcheck OK: Apache local sirve correctamente el vhost ${HEALTHCHECK_DOMAIN}."
  exit 0
fi

# Si loopback cae en vhost interno Plesk, prueba con IP no-loopback del servidor.
fallback_ip="$(detect_domain_non_loopback_ip || true)"
if [[ -n "${fallback_ip:-}" ]]; then
  echo "Aviso: fallback a IP local/no-loopback ${fallback_ip}."
  if check_route "http://${fallback_ip}" "/" \
    && check_route "http://${fallback_ip}" "/blog/" \
    && check_route "http://${fallback_ip}" "/equipo.html"; then
    echo "Healthcheck OK: Apache sirve correctamente el vhost ${HEALTHCHECK_DOMAIN} por IP local."
    exit 0
  fi
fi

echo "Fallo: no se pudo validar localmente el vhost ${HEALTHCHECK_DOMAIN} en Apache."
exit 1
