FROM node:22-alpine AS base
RUN corepack enable
RUN corepack prepare yarn@4.3.1 --activate
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --immutable
COPY . .
RUN yarn build
EXPOSE 3000
CMD ["yarn", "start"]
