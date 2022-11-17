###################
# BUILD FOR LOCAL DEVELOPMENT
###################

FROM node:18-alpine As development

# Create app directory
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure copying both package.json AND package-lock.json (when available).
# Copying this first prevents re-running yarn install on every code change.
COPY --chown=node:node package*.json ./
COPY --chown=node:node yarn.lock ./

# Ensure git is installed
RUN apk add --no-cache git g++ make py3-pip

# Install app dependencies
RUN mkdir .yarncache
RUN yarn install --skip-integrity-check --cache-folder ./.yarncache

# Bundle app source
COPY --chown=node:node . .

# Use the node user from the image (instead of the root user)
USER node

###################
# BUILD FOR PRODUCTION
###################

FROM node:18-alpine As build

WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./

# In order to run `yarn build` we need access to the Nest CLI which is a dev dependency. In the previous development stage we ran `yarn install` which installed all dependencies, so we can copy over the node_modules directory from the development image
COPY --chown=node:node --from=development /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=development /usr/src/app/.yarncache ./.yarncache

COPY --chown=node:node . .

# Ensure git is installed
RUN apk add --no-cache git g++ make py3-pip
RUN git config --global --add safe.directory '*'

# Run the build command which creates the production bundle
RUN yarn build

# Set NODE_ENV environment variable
ENV NODE_ENV production

# Passing in --frozen-lockfile ensures that only the lockfile must match the package.json
RUN yarn install --skip-integrity-check --frozen-lockfile --cache-folder ./.yarncache && yarn cache clean
RUN rm -rf .yarncache

USER node

###################
# PRODUCTION
###################

FROM node:18-alpine As production

# Copy the bundled code from the build stage to the production image
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist

# Start the server using the production build
CMD [ "node", "dist/src/main.js" ]
