FROM node:lts-alpine as build-runner

WORKDIR /tmp/app

COPY package.json .
COPY pnpm-lock.yaml .

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY src ./src
COPY tsconfig.json .

RUN pnpm run build

FROM node:lts-alpine as prod-deps-runner

WORKDIR /tmp/app

COPY package.json .
COPY pnpm-lock.yaml .

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --only=production

FROM node:lts-alpine as prod-runner

WORKDIR /app

COPY --from=prod-deps-runner /tmp/app/package.json /app/package.json
COPY --from=prod-deps-runner /tmp/app/node_modules /app/node_modules
COPY --from=build-runner /tmp/app/dist /app/dist

CMD [ "node", "." ]
