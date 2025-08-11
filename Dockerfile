FROM node:22-alpine AS base
RUN corepack enable
RUN corepack prepare yarn@4.3.1 --activate
RUN apk add --no-cache git
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn install --immutable --inline-builds
COPY . .
RUN yarn build
EXPOSE 3000
CMD ["yarn", "start"]

