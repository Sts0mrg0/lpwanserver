import React, { Component } from 'react';
//import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

import dispatcher from "../dispatcher";
import sessionStore from "../stores/SessionStore";

class Navbar extends Component {
  static contextTypes = {
    router: PropTypes.object.isRequired
  };

  constructor() {
    super();
    this.state = {
      user: sessionStore.getUser(),
      isAdmin: sessionStore.isAdmin(),
      isGlobalAdmin: sessionStore.isGlobalAdmin(),
      userDropdownOpen: false,
    }

    this.userToggleDropdown = this.userToggleDropdown.bind(this);
    this.networkToggleDropdown = this.networkToggleDropdown.bind(this);
    this.handleActions = this.handleActions.bind(this);
  }

  userToggleDropdown() {
	    this.setState({
	      userDropdownOpen: !this.state.userDropdownOpen,
	    });
	  }

  networkToggleDropdown() {
	    this.setState({
	      networkDropdownOpen: !this.state.networkDropdownOpen,
	    });
	  }

  handleActions(action) {
    switch(action.type) {
      case "BODY_CLICK": {
        this.setState({
            userDropdownOpen: false,
        });
        break;
      }
      default:
        break;
    }
  }

  componentWillMount() {
    sessionStore.on("change", () => {
      this.setState({
        user: sessionStore.getUser(),
        isAdmin: sessionStore.isAdmin(),
        isGlobalAdmin: sessionStore.isGlobalAdmin(),
        userDropdownOpen: false,
        networkDropdownOpen: false,
      });
    });

    dispatcher.register(this.handleActions);
  }

  render() {
    return (
      <nav className="navbar navbar-default navbar-fixed-top">
        <div className="container">
          <div className="navbar-header">
            <a className="navbar-brand" href="/">LPWAN Server</a>
          </div>
          <div id="navbar" className="navbar-collapse collapse">
            <ul className="nav navbar-nav navbar-right">

                <li className={this.state.isGlobalAdmin === true ? "" : "hidden"}><a href="/admin/companies">Companies</a></li>

                <li className={"dropdown " + (this.state.isGlobalAdmin === true ? "" : "hidden") + (this.state.networkDropdownOpen ? "open" : "")}>
                    <a onClick={this.networkToggleDropdown} className="dropdown-toggle">Networks <span className="caret" /></a>
                    <ul className="dropdown-menu" onClick={this.networkToggleDropdown}>
                  <li><a href={`/admin/networkTypes`}>Network Types</a></li>
                  <li><a href={`/admin/networkProviders`}>Network Providers</a></li>
                  <li><a href={`/admin/networkProtocols`}>Network Protocols</a></li>
                  <li><a href={`/admin/networks`}>Networks</a></li>
                </ul>
               </li>

               <li className={this.state.isGlobalAdmin === true ? "" : "hidden"}><a href="/admin/reportingProtocols">Application Reporting Protocols</a></li>

                <li className={"dropdown " + (typeof(this.state.user.username) === "undefined" ? "hidden" : "") + (this.state.userDropdownOpen ? "open" : "")}>
                  <a onClick={this.userToggleDropdown} className="dropdown-toggle">{this.state.user.username} <span className="caret" /></a>
                  <ul className="dropdown-menu" onClick={this.userToggleDropdown}>
                    <li><a href={`users/${this.state.user.id}/password`}>Change password</a></li>
                    <li><a href="/login">Logout</a></li>
                  </ul>
                </li>

            </ul>
          </div>
        </div>
      </nav>
    );
  }
}

export default Navbar;
