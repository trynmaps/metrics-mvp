# OpenTransit's Metrics MVP

Welcome to OpenTransit! We're passionate about using open data to improve
public transit systems around the world, starting with San Francisco.

This app uses historical transit data to help riders understand
the quality of SF Muni bus and subway lines. [Check out the app!](http://muni.opentransit.city/)

## Building the app

To start, you'll need to get Docker. Install [Docker Desktop](https://www.docker.com/products/docker-desktop) or another Docker distribution for your platform.

Build and run the Docker containers:

```sh
docker-compose up
```

This will run the React frontend in development mode at http://localhost:3000,
and the Flask backend in development mode at http://localhost:5000.

Your local directory will be shared within the Docker container at `/app`.
When you edit files in your local directory, the React and Flask containers should automatically update with the new code.

To start a shell within the Flask Docker container, run `./docker-shell.sh` (Linux/Mac) or `docker-shell` (Windows).

You can run command line scripts like `compute_arrivals.py` and `headways.py` from the shell in the Docker container.

If you need to install some new dependencies in the Docker images, you can rebuild them via `docker-compose build`.

## Contributing

Make sure you've been added to the trynmaps organization on GitHub.
[Join the Code for SF Slack](http://c4sf.me/slack) and join the #opentransit channel,
then you'll see a guide to get in.

To get started, see the Issues page. You may want to [identify good first issues](https://github.com/trynmaps/metrics-mvp/labels/Good%20First%20Issue).

### Deploying to Heroku

When you make a Pull Request, we would suggest you deploy your branch to Heroku so that other
team members can try out your feature.

First, create an account  at [heroku.com](https://heroku.com) and
[create an app](https://dashboard.heroku.com/apps). Follow the instructions to deploy
using Heroku Git with an existing Git repository.

The first time you deploy to Heroku, you'll need to tell it to build Docker
containers using heroku.yml:

```sh
heroku stack:set container
```

You then need to set up a remote called `heroku`. Then run this to deploy your local branch:

```sh
git push heroku local-branch-name:master
```

Then copy the link to this app and paste it in the PR.

## How Deployment Works

Once a PR is merged into master, Google Cloud Build  will automatically build
the latest code and deploy it to a cluster on Google Kubernetes Engine (GKE).
The build steps are defined in `cloudbuild.yaml`.

## Frontend code

The frontend React code is in the /frontend directory and is built using Create React App.
For more information, see https://facebook.github.io/create-react-app/docs/folder-structure

## Tech Stack Decisions

### Overall
- Docker - We use Docker to ensure a consistent environment across all machines
- Docker Compose - We use Docker Compose to run multiple containers at once

### Frontend
- NPM - Due to both the NPM and Yarn package managers offering roughly the same performance, Yarn being a superset of NPM, and there was nothing in the Yarn roadmap which would indicate it would make it worthwhile in the future, we went with NPM
- React - Our team members switched projects over from OpenTransit Map and decided to use the same frontend framework
- Material UI - We decided to migrate to Material UI, because it has zero dependence on jQuery (unlike Bootstrap), it is the most popular React framework, and it offers a more fluid and pleasant experience for mobile users
- Functional Components - We migrated away from ES6 React Components and introduced [Functional Components](https://reactjs.org/docs/components-and-props.html) instead due to the simplification of component logic and the ability to use React Hooks
- Redux Thunk - We use Redux for state management and to simplify our application and component interaction, and Thunk as middleware
- React Hooks - We use React Hooks to manage interactions with state management


## Notes for developers

If you ever need to use a new pip library, make sure you run `pip freeze > requirements.txt`
so other contributors have the latest versions of required packages.

If you're developing within Docker on Windows, by default, React does not automatically recompile the frontend code when you make changes.
In order to allow React to automatically recompile the frontend code within the Docker container when you edit files shared from your
Windows host computer, you can create a docker-compose.override.yml to enable CHOKIDAR_USEPOLLING like this:

```
version: "3.7"
services:
  react-dev:
    environment:
      CHOKIDAR_USEPOLLING: "true"
      CHOKIDAR_INTERVAL: "2500"
```

This setting is not in the main docker-compose.yml file because CHOKIDAR_USEPOLLING causes high CPU/battery usage for developers using Mac OS X,
and CHOKIDAR_USEPOLLING is not necessary on Mac OS X to automatically recompile the frontend code when it changes.
