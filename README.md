[![Build Status](https://travis-ci.org/cablelabs/lpwanserver.svg?branch=master)](https://travis-ci.org/cablelabs/lpwanserver)
[![Coverage Status](https://coveralls.io/repos/github/cablelabs/lpwanserver/badge.svg?branch=master)](https://coveralls.io/github/cablelabs/lpwanserver?branch=master)
[![dependencies Status](https://david-dm.org/cablelabs/lpwanserver/status.svg)](https://david-dm.org/cablelabs/lpwanserver)

# LPWAN Server (lpwanserver)

The LPWAN Server is the backend CableLabs' [LPWAN Server](http://lpwanserver.com/)
project. It is a Node.js REST server that sits above a set of LPWANs that may
employ differing LPWAN technologies and may be owned by one or more LPWAN
operators. The LPWAN Server provides a unified interface across LPWAN
technologies and/or operators as a single interface to Low Power WAN (LPWAN)
application vendors. It collects the data generated by the devices, and forwards
that data to a server for the application.

## Web Client

The official LPWAN Server web client is maintained in the
[lpwanserver-web-client](https://github.com/cablelabs/lpwanserver-web-client)
repository.

## Getting started

You'll probably want to start by reading the
[LPWAN Server Overview](http://lpwanserver.com/overview/).

The easiest way to run LPWAN Server is to follow the
[Quickstart Docker-Compose](http://lpwanserver.com/guides/dockercompose/)
guide.

For development and customization, refer to the
[install documentation](https://lpwanserver.com/install/requirements/).

## Contributing

LPWAN Server was originally built by [CableLabs](http://cablelabs.com/), but
we could use your help! Check out our [contributing guidelines](CONTRIBUTING.md)
to get started.

## Other important stuff

We use an [Apache 2.0 License](LICENSE) for LPWAN Server.

Questions? Just send us an email at
[lpwanserver@cablelabs.com](mailto:lpwanserver@cablelabs.com) or join the
conversation on the [forum](http://forum.lpwanserver.com/).
