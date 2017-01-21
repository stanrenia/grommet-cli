/**
* Node dependencies
**/
import path from 'path';
import opn from 'opn';

/**
* NPM dependencies
**/
import chalk from 'chalk';
import emoji from 'node-emoji';
import fs from 'fs-extra';
import prettyHrtime from 'pretty-hrtime';
import rimraf from 'rimraf';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';

const delimiter = chalk.magenta('[grommet:pack]');

const ENV = process.env.NODE_ENV || 'production';
const PORT = process.env.PORT || 3000;

function deleteDistributionFolder() {
  return new Promise((resolve, reject) => {
    console.log(
      `${delimiter}: Deleting previously generated distribution folder...`
    );
    rimraf(path.resolve('dist'), (err) => err ? reject(err) : resolve());
  });
}

function copyPublicFolder() {
  return new Promise((resolve, reject) => {
    console.log(
      `${delimiter}: Copying public folder...`
    );

    const publicFolder = path.resolve('public');
    fs.exists(publicFolder, (exists) => {
      if (exists) {
        fs.copy(
          path.resolve('public'), path.resolve('dist'),
          (err) => err ? reject(err) : resolve()
        );
      } else {
        console.log(
          `${delimiter}: ${chalk.yellow('warning')} Public folder does not exist...`
        );
        resolve();
      }
    });
  });
}

function runDevServer(compiler) {
  console.log(
    `${delimiter}: Starting dev server...`
  );
  getDevServerConfig().then((devServerConfig) => {
    const devServer = new WebpackDevServer(compiler, devServerConfig);

    devServer.listen(PORT, (err, result) => {
      if (err) {
        throw err;
      }
    });
  }).catch(err => console.log(err));
}

function build(config) {
  return new Promise((resolve, reject) => {
    let handleResponse;
    // only handle response for production mode
    if (ENV === 'production') {
      handleResponse = (err, stats) => {
        const statHandler = (stat) => {
          if (err) {
            reject(err);
          } else if (stat.compilation.errors.length) {
            reject(stat.compilation.errors);
          } else {
            console.log(stat.toString({
              chunks: false,
              colors: true
            }));
          }
        };

        if (stats.stats) { // multiple stats
          stats.stats.forEach(statHandler);
        } else {
          statHandler(stats);
        }
        resolve();
      };
    }
    const compiler = webpack(config, handleResponse);

    if (ENV === 'development') {
      let firstCompilation = true;
      compiler.plugin('done', (stats) => {
        const statHandler = (stat) => {
          if (stat.compilation.errors.length) {
            errorHandler(stat.compilation.errors);
          } else {
            console.log(stat.toString({
              chunks: false,
              colors: true
            }));

            console.log(
              `${delimiter}: ${chalk.green('success')}`
            );

            if (firstCompilation) {
              console.log(
                `${delimiter}: Opening the browser at http://localhost:${PORT}`
              );

              opn(`http://localhost:${PORT}`);
            }

            firstCompilation = false;
          }
        };

        if (stats.stats) { // multiple stats
          stats.stats.forEach(statHandler);
        } else {
          statHandler(stats);
        }
      });
      runDevServer(compiler);
    }
  });
}

function getWebpackConfig() {
  return new Promise((resolve, reject) => {
    let webpackConfig = path.resolve(process.cwd(), 'webpack.config.js');
    fs.exists(webpackConfig, (exists) => {
      if (exists) {
        resolve(require(webpackConfig));
      } else {
        webpackConfig = path.resolve(process.cwd(), 'webpack.config.babel.js');
        fs.exists(webpackConfig, (exists) => {
          if (exists) {
            resolve(require(webpackConfig).default);
          } else {
            reject('Webpack config not found');
          }
        });
      }
    });
  });
}

function getDevServerConfig() {
  return new Promise((resolve, reject) => {
    let devServerConfig = path.resolve(process.cwd(), 'devServer.config.js');
    fs.exists(devServerConfig, (exists) => {
      if (exists) {
        resolve(require(devServerConfig));
      } else {
        devServerConfig = path.resolve(
          process.cwd(), 'devServer.config.babel.js'
        );
        fs.exists(devServerConfig, (exists) => {
          if (exists) {
            resolve(require(devServerConfig).default);
          } else {
            reject('devServer config not found');
          }
        });
      }
    });
  });
}

function packProject() {
  return new Promise((resolve, reject) => {
    console.log(
      `${delimiter}: Running webpack...`
    );
    getWebpackConfig().then(
      (config) => build(config).then(resolve, reject), reject
    );
  });
}

function errorHandler(err = {}) {
  console.log(
    `${delimiter}: ${chalk.red('failed')}`
  );
  const isArray = Array.isArray(err);
  if (isArray) {
    err.forEach(e => console.error(e.message ? e.message : e));
  } else {
    console.error(err.message ? err.message : err);
  }
}

export default function (vorpal) {
  vorpal
    .command(
      'pack',
      'Builds a grommet application for development and/or production'
    )
    .action((args, cb) => {
      const timeId = process.hrtime();

      deleteDistributionFolder()
        .then(copyPublicFolder)
        .then(packProject)
        .then(() => {
          console.log(
            `${delimiter}: ${chalk.green('success')}`
          );
          const t = process.hrtime(timeId);
          console.log(`${emoji.get('sparkles')} ${prettyHrtime(t)}`);
        }).catch((err) => {
          errorHandler(err);
          process.exit(1);
        });
    });
};
