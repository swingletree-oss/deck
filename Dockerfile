# build swingletree
FROM node:13-alpine as build

ARG NPM_REGISTRY=https://registry.npmjs.org/
ARG GITHUB_PKG_TOKEN=

ENV GITHUB_TOKEN=$GITHUB_PKG_TOKEN

COPY . /usr/src/swingletree
WORKDIR /usr/src/swingletree

#RUN npm set registry "${NPM_REGISTRY}"
RUN npm ci
RUN npm run sass
RUN npm run build
RUN npm prune --production

# swingletree container image
FROM node:13-alpine

ENV NODE_ENV "production"

RUN mkdir -p /opt/deck
WORKDIR /opt/deck

# add build artifacts from builder image
COPY --from=build /usr/src/swingletree/bin .
COPY --from=build /usr/src/swingletree/node_modules ./node_modules

# add misc files like views or configurations
COPY views ./views
COPY swingletree.conf.yaml .
COPY --from=build /usr/src/swingletree/static ./static

ENTRYPOINT [ "node", "main.js" ]
