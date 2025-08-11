FROM node:22-alpine AS base
RUN corepack enable
RUN corepack prepare yarn@4.3.1 --activate
RUN apk add --no-cache git
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn install --immutable --inline-builds
COPY . .
ENV SKIP_DATABASE_URL="true"
ENV NEXT_PUBLIC_AUTH0_API_AUDIENCE="https://ideaflow-mew.us.auth0.com/api/v2/"
ENV NEXT_PUBLIC_AUTH0_CLIENT_ID="jRx0LeaDjmv2MHQxRR5ZzfXUttkTB4La"
ENV NEXT_PUBLIC_AUTH0_DOMAIN="ideaflow-mew.us.auth0.com"
ENV NEXT_PUBLIC_ENV="production"
ENV NEXT_PUBLIC_IS_AUTH_ENABLED="true"
ENV NEXT_PUBLIC_PERSISTENCE_ENABLED="true"
ENV NEXT_PUBLIC_PERSIST_TO="server"
ENV NEXT_PUBLIC_PUSHER_CHANNEL_PREFIX="prod"
ENV NEXT_PUBLIC_PUSHER_CLUSTER="us3"
ENV NEXT_PUBLIC_PUSHER_KEY="ba91e0d8e0474767fd40"
ENV NEXT_PUBLIC_USE_MOCK_USER_IF_AUTH_DISABLED="false"
RUN yarn build
EXPOSE 3000
CMD ["yarn", "start"]

