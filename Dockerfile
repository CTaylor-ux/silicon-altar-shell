# The Silicon Altar shell.
#
# THE DERIVED ARTIFACTS ARE BUILT OUTSIDE THIS IMAGE, ON PURPOSE.
#
# `npm run build` normally runs prepare-windows and prepare-corpus first, and
# both read the audit repo through SILICON_ALTAR_REPO. The audit repo is a
# separate private repository and has no business inside a container build. So
# the operator runs the prepare steps locally — where the audit repo lives and
# where verify_regeneration.py has just passed — and this image compiles what
# those steps produced.
#
# That is not a workaround. It means the deployed corpus is byte-for-byte the
# corpus the operator verified, rather than whatever the audit repo happened to
# contain when a build server pulled it.
#
#   npm run prepare-windows && npm run prepare-corpus     # then:
#   docker build -t silicon-altar .
#
# The build FAILS below if those artifacts are missing, rather than quietly
# shipping a shell with no windows in it.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Fail loudly and early if the prepare steps were not run on the host.
RUN test -d public/windows && test -n "$(ls -A public/windows)" \
      || (echo "ERROR: public/windows is empty. Run 'npm run prepare-windows' first." && exit 1) \
 && test -f lib/corpus.generated.json \
      || (echo "ERROR: lib/corpus.generated.json missing. Run 'npm run prepare-corpus' first." && exit 1) \
 && test -f lib/corpus.prompt.txt \
      || (echo "ERROR: lib/corpus.prompt.txt missing. Run 'npm run prepare-corpus' first." && exit 1)

ENV NEXT_TELEMETRY_DISABLED=1
# `next build` directly, NOT `npm run build` — the prepare steps already ran.
RUN npx next build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3210

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The record store. Mount a volume here or every record dies with the container
# — and "only a lost record is a loss" is the rule /api/ask is built around.
RUN mkdir -p /app/records && chown nextjs:nodejs /app/records
VOLUME ["/app/records"]

USER nextjs
EXPOSE 3210
CMD ["node", "server.js"]
