#!/usr/bin/env bash
# Built by Anointed Coder.
#
# cloudflare-ufw.sh
#
# Locks HTTP and HTTPS on this VPS down to the published Cloudflare edge
# ranges so nobody can bypass Cloudflare and hit the origin IP directly.
# SSH is allowed (and rate limited) FIRST, before anything else, and ufw
# is only enabled after the SSH rule is confirmed present, so a failed run
# can never lock you out. The default policy is set to deny incoming /
# allow outgoing (without that, scoped allow rules are a no-op), and the
# script ends by verifying the policy, the 80/443 scoping, and that
# port 3000 is not exposed.
#
# !!! RUN THIS ONLY AFTER CLOUDFLARE IS PROXYING pasha9.com (orange cloud
# !!! on, site verified loading through Cloudflare). Running it before the
# !!! nameserver flip will take the site offline for every visitor.
#
# Usage:
#   sudo ./scripts/cloudflare-ufw.sh --dry-run   # print what would happen
#   sudo ./scripts/cloudflare-ufw.sh             # apply for real
#
# Idempotent: safe to re-run. Re-running refreshes the Cloudflare ranges
# (Cloudflare occasionally adds new ones) and removes stale generic
# port 80/443 allows.

set -u

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

log() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    log "[dry-run] $*"
    return 0
  fi
  "$@"
}

if [ "$DRY_RUN" -eq 0 ] && [ "$(id -u)" -ne 0 ]; then
  die "run as root (sudo). Use --dry-run to preview without root."
fi

command -v ufw  >/dev/null 2>&1 || die "ufw is not installed (apt install -y ufw)"
command -v curl >/dev/null 2>&1 || die "curl is not installed"

# ---------------------------------------------------------------------------
# Step 1: SSH first. This must succeed before anything else happens.
# "ufw limit" both allows and rate limits SSH (6 connections / 30s per IP).
# ---------------------------------------------------------------------------
log "==> Step 1: allow and rate limit SSH"
run ufw allow OpenSSH || die "could not add the OpenSSH allow rule; aborting before touching anything else"
run ufw limit OpenSSH || die "could not add the OpenSSH limit rule; aborting"

# ---------------------------------------------------------------------------
# Step 1b: default policies. Without "default deny incoming" the whole
# lockdown is a no-op: allow rules scoped to Cloudflare mean nothing if
# everything is allowed by default anyway. Safe to set here because the
# SSH allow rule already exists above.
# ---------------------------------------------------------------------------
log "==> Step 1b: set default policies (deny incoming, allow outgoing)"
run ufw default deny incoming || die "could not set default deny incoming; aborting"
run ufw default allow outgoing || die "could not set default allow outgoing; aborting"

# ---------------------------------------------------------------------------
# Step 2: fetch the current Cloudflare ranges and validate them.
# Abort on any fetch problem; an empty list must never reach ufw.
# ---------------------------------------------------------------------------
log "==> Step 2: fetch Cloudflare IP ranges"
CF_V4="$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4)" || die "failed to fetch ips-v4; firewall NOT changed for 80/443, SSH remains open"
CF_V6="$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6)" || die "failed to fetch ips-v6; firewall NOT changed for 80/443, SSH remains open"

[ -n "$CF_V4" ] || die "ips-v4 came back empty; aborting"
[ -n "$CF_V6" ] || die "ips-v6 came back empty; aborting"

# Every line must look like a CIDR. Reject the whole run on the first
# malformed line (an HTML error page must never become a firewall rule).
validate_cidrs() {
  list="$1"; pattern="$2"; label="$3"
  count=0
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    printf '%s' "$line" | grep -Eq "$pattern" || die "$label returned a non CIDR line: '$line'; aborting"
    count=$((count + 1))
  done <<EOF
$list
EOF
  [ "$count" -gt 0 ] || die "$label contained no CIDR entries; aborting"
  log "    $label: $count ranges validated"
}

validate_cidrs "$CF_V4" '^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$' "ips-v4"
validate_cidrs "$CF_V6" '^[0-9A-Fa-f:]+/[0-9]{1,3}$' "ips-v6"

# ---------------------------------------------------------------------------
# Step 3: allow 80 and 443 from the Cloudflare ranges only.
# ufw skips duplicates on its own, so re-runs are clean.
# ---------------------------------------------------------------------------
log "==> Step 3: allow 80 and 443 from Cloudflare ranges"
while IFS= read -r cidr; do
  [ -z "$cidr" ] && continue
  run ufw allow proto tcp from "$cidr" to any port 80,443 comment "Cloudflare edge" \
    || die "failed adding rule for $cidr; SSH remains open, review 'ufw status' before enabling"
done <<EOF
$CF_V4
$CF_V6
EOF

# ---------------------------------------------------------------------------
# Step 4: drop any previous generic (any source) allow of 80/443.
# Runs after the scoped rules exist so there is no window with no web rule.
# ---------------------------------------------------------------------------
log "==> Step 4: remove generic 80/443 allows"
for rule in "80/tcp" "443/tcp" "80" "443" "Nginx Full" "Nginx HTTP" "Nginx HTTPS" "80,443/tcp"; do
  if [ "$DRY_RUN" -eq 1 ]; then
    log "[dry-run] ufw delete allow $rule (if present)"
  else
    # "ufw delete" fails harmlessly when the rule does not exist.
    ufw delete allow "$rule" >/dev/null 2>&1 || true
    ufw delete allow "\"$rule\"" >/dev/null 2>&1 || true
  fi
done

# ---------------------------------------------------------------------------
# Step 5: enable ufw, but only after confirming the SSH rule is really there.
# ---------------------------------------------------------------------------
log "==> Step 5: enable ufw (SSH rule must be present first)"
if [ "$DRY_RUN" -eq 1 ]; then
  log "[dry-run] would verify 'ufw show added' lists OpenSSH, then run: ufw --force enable"
else
  if ufw status | grep -qi "^Status: active"; then
    if ! ufw status | grep -qi "OpenSSH"; then
      die "ufw is active but no OpenSSH rule is visible; NOT proceeding. Add it manually: ufw allow OpenSSH"
    fi
    log "    ufw already active with an OpenSSH rule; nothing to enable"
  else
    ufw show added | grep -qi "OpenSSH" || die "OpenSSH rule not staged; refusing to enable ufw"
    ufw --force enable || die "ufw enable failed; firewall left inactive, SSH unaffected"
  fi
fi

# ---------------------------------------------------------------------------
# Step 6: show the result and verify the lockdown actually holds.
# Three checks: default policy is deny incoming, 80/443 are scoped to the
# Cloudflare ranges only (no "Anywhere" web allows), and port 3000 (the
# Next.js app behind Nginx) has no allow rule at all.
# ---------------------------------------------------------------------------
log "==> Step 6: final state and verification"
if [ "$DRY_RUN" -eq 1 ]; then
  log "[dry-run] ufw status verbose"
  log "[dry-run] would verify the default policy is 'deny (incoming), allow (outgoing)'"
  log "[dry-run] would verify no 80/443 allow rule is open to Anywhere (Cloudflare ranges only)"
  log "[dry-run] would verify port 3000 has NO allow rule (warn loudly if it does)"
else
  STATUS_VERBOSE="$(ufw status verbose)"
  STATUS_RULES="$(ufw status)"
  printf '%s\n' "$STATUS_VERBOSE"
  log ""
  log "==> Verification"

  # 1. Default policy.
  if printf '%s\n' "$STATUS_VERBOSE" | grep -qi "deny (incoming)"; then
    log "    OK: default incoming policy is deny"
  else
    log "    WARNING: default incoming policy is NOT deny. The Cloudflare"
    log "    lockdown does nothing without it. Fix: ufw default deny incoming"
  fi

  # 2. Web ports scoped to Cloudflare only: any 80/443 allow whose source
  #    is "Anywhere" defeats the whole point.
  GENERIC_WEB="$(printf '%s\n' "$STATUS_RULES" | grep -E '^(80|443|80,443)(/tcp)?[[:space:]]' | grep -i 'ALLOW' | grep -i 'Anywhere' || true)"
  if [ -n "$GENERIC_WEB" ]; then
    log "    WARNING: generic 80/443 allow rules are still present (open to any source):"
    printf '%s\n' "$GENERIC_WEB" | sed 's/^/        /'
    log "    Delete them (ufw delete allow ...) so only the Cloudflare ranges remain."
  else
    log "    OK: 80/443 are only allowed from the Cloudflare ranges"
  fi

  # 3. Port 3000 must never be reachable from outside; players and
  #    attackers must go through Nginx (and Cloudflare), not straight to
  #    the app. Match 3000 as a whole port number only.
  PORT_3000="$(printf '%s\n' "$STATUS_RULES" | grep -E '(^|[^0-9])3000([^0-9]|$)' | grep -i 'ALLOW' || true)"
  if [ -n "$PORT_3000" ]; then
    log ""
    log "    !!! WARNING: port 3000 has an ALLOW rule. The Next.js app is"
    log "    !!! reachable directly, bypassing Nginx AND Cloudflare AND the"
    log "    !!! real IP restore. Remove it now, for example:"
    log "    !!!     ufw delete allow 3000"
    log "    !!! Offending rule(s):"
    printf '%s\n' "$PORT_3000" | sed 's/^/        /'
  else
    log "    OK: port 3000 has no allow rule"
  fi
fi

log ""
log "Done. Verify from OUTSIDE the Cloudflare network that a direct hit on"
log "the origin IP now times out:  curl -m 10 -k https://69.62.76.83/  (expect timeout)"
log "and that the site still loads normally at https://pasha9.com through Cloudflare."
