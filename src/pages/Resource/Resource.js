/**
 * @file
 * @author huangzongzhe  zhouminghui
 * 233333
 * TODO: Vote && Resource To migrate out of Application
 */

import React, { Component } from 'react';
import { message } from 'antd';
import { connect } from 'react-redux';

import AElfBridge from 'aelf-bridge';
import config, {
  DEFAUTRPCSERVER,
} from '@config/config';
const HTTP_PROVIDER = DEFAUTRPCSERVER;
const bridgeInstance = new AElfBridge({
  endpoint: HTTP_PROVIDER
});

import { aelf } from '../../utils';
import { APPNAME, resourceTokens } from '../../../config/config';
import DownloadPlugins from '../../components/DownloadPlugins/DownloadPlugins';
import ResourceAElfWallet from './components/ResourceAElfWallet/ResourceAElfWallet';
import NightElfCheck from '../../utils/NightElfCheck';
import getContractAddress from '../../utils/getContractAddress.js';
import ResourceMoneyMarket from './components/ResourceMoneyMarket/ResourceMoneyMarket';
import getLogin from '../../utils/getLogin';
import { isPhoneCheck } from '../../utils/deviceCheck';
import './Resource.less';

const appName = APPNAME;
class Resource extends Component {
  constructor(props) {
    super(props);
    this.informationTimer;
    this.state = {
      currentWallet: null,
      contracts: null,
      tokenContract: null,
      tokenConverterContract: null,
      showDownloadPlugins: false,
      showWallet: false,
      currentBalance: 0,
      resourceTokens: resourceTokens.map(v => ({...v, balance: 0})),
      loading: false,
      nightElf: null
    };
    this.walletRef = null;
    this.getResource = this.getResource.bind(this);
    this.getCurrentBalance = this.getCurrentBalance.bind(this);
    this.loginAndInsertKeypairs = this.loginAndInsertKeypairs.bind(this);
  }

  componentDidMount() {
    getContractAddress().then(result => {
      this.setState({
        contracts: result
      });
      if (!result.chainInfo) {
        message.error(
          'The chain has stopped or cannot be connected to the chain. Please check your network or contact us.',
          10
        );
        return;
      }
      aelf.chain.contractAt(
        result.multiToken,
        result.wallet,
        (error, result) => {
          this.setState({
            tokenContract: result
          });
        }
      );
      aelf.chain.contractAt(
        result.tokenConverter,
        result.wallet,
        (error, result) => {
          this.setState({
            tokenConverterContract: result
          });
        }
      );
    });

    NightElfCheck.getInstance()
      .check.then(item => {
        // console.log('NightElfCheck.getInstance():', item);
        if (!item) {
          return;
        }
        const nightElf = NightElfCheck.getAelfInstanceByExtension();
        // console.log('NightElfCheck.getInstance(): nightElf', nightElf);
        if (nightElf) {
          this.setState({
            nightElf
          });
          nightElf.chain.getChainStatus().then(result => {
            if (result) {
              this.loginAndInsertKeypairs(result);
            }
          }).catch(error => {
            console.log('error: ', error);
          });
        }
      })
      .catch(error => {
        // console.log('NightElfCheck : error', error);
        this.setState({
          showDownloadPlugins: true
        });
      });
  }

  loginAndInsertKeypairs(useLock = true, toastMessage = true) {
    // console.log('loginAndInsertKeypairs: 3 ', new Date().getTime(), this.state.nightElf);
    const { nightElf } = this.state;
    const getLoginPayload = {
      appName,
      connectChain: this.connectChain
    };

    getLogin(nightElf, getLoginPayload, result => {
      // console.log('getLogin result 31: ', result);
      if (result && result.error === 0) {
        const wallet = JSON.parse(result.detail);
        this.getNightElfKeypair(wallet);
        toastMessage && message.success('Login success!!', 3);
        // }
      } else {
        this.setState({
          showWallet: false
        });
        if (result.error === 200010) {
          message.warn('Please Login.');
        } else {
          message.warn(result.errorMessage.message || 'Please check your NightELF browser extension.')
        }
      }
    }, useLock);
  }

  getNightElfKeypair(wallet) {
    if (wallet) {
      localStorage.setItem('currentWallet', JSON.stringify(wallet));
      this.setState({
        currentWallet: wallet,
        showWallet: true
      });
    }
  }

  getCurrentBalance(value) {
    this.setState({
      currentBalance: value
    });
  }

  getDownloadPluginsHTML() {
    return <DownloadPlugins />;
  }

  onRefresh() {
    setTimeout(() => {
      this.walletRef.refreshWalletInfo();
    }, 2000);
    this.setState({
      loading: true
    });
  }

  endRefresh() {
    this.setState({
      loading: false
    });
  }

  getResource(resource) {
    this.setState({
      resourceTokens: resource.map(v => ({...v}))
    });
  }

  resourceAElfWalletHtml() {
    const {
      tokenContract,
      tokenConverterContract,
      currentWallet,
      resourceTokens,
      currentBalance
    } = this.state;
    return (
        <ResourceAElfWallet
            title='AELF Wallet'
            ref={wallet => {
              this.walletRef = wallet;
            }}
            tokenContract={tokenContract}
            tokenConverterContract={tokenConverterContract}
            currentWallet={currentWallet}
            getCurrentBalance={this.getCurrentBalance}
            getResource={this.getResource}
            resourceTokens={resourceTokens}
            balance={currentBalance}
            loginAndInsertKeypairs={this.loginAndInsertKeypairs}
        />
    );
  }

  render() {
    const {
      currentBalance,
      appName,
      showDownloadPlugins,
      currentWallet,
      contracts,
      tokenContract,
      tokenConverterContract,
      nightElf,
      resourceTokens
    } = this.state;
    let account = {
      balance: currentBalance,
      resourceTokens
    };
    let downloadPlugins = null;
    if (showDownloadPlugins) {
      downloadPlugins = [this.getDownloadPluginsHTML(), <div className='resource-blank' />];
    }
    const resourceAElfWalletHtml = this.resourceAElfWalletHtml();
    const isPhone = isPhoneCheck();
    return (
      <div className='resource-body basic-container basic-container-white'>
        {!isPhone && downloadPlugins}
        {/*{isPhone && <div className='resource-pc-note'>In PC, you can find more operations and information.</div>}*/}
        {nightElf && resourceAElfWalletHtml}
        <div className='resource-money-market'>
          <ResourceMoneyMarket
            loginAndInsertKeypairs={this.loginAndInsertKeypairs}
            currentWallet={currentWallet}
            contracts={contracts}
            tokenContract={tokenContract}
            tokenConverterContract={tokenConverterContract}
            account={account}
            onRefresh={this.onRefresh.bind(this)}
            endRefresh={this.endRefresh.bind(this)}
            nightElf={nightElf}
            walletRef={this.walletRef}
            appName={appName}
          />
        </div>
      </div>
    );
  }
}

const mapStateToProps = state => ({
  ...state.common
});

export default connect(mapStateToProps)(Resource);
