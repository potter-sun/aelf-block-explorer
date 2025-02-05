/*
 * @Author: Alfred Yang
 * @Github: https://github.com/cat-walk
 * @Date: 2019-12-07 13:16:37
 * @LastEditors: Alfred Yang
 * @LastEditTime: 2019-12-10 17:07:00
 * @Description: file content
 */
import React, { PureComponent } from 'react';
import { Button, Icon, Modal, message, Spin } from 'antd';
import moment from 'moment';

import './MyWalletCard.less';
import { thousandsCommaWithDecimal } from '@utils/formater';
import { ELF_DECIMAL, SYMBOL } from '@src/constants';
import { APPNAME } from '@config/config';
import NightElfCheck from "../../../../utils/NightElfCheck";
import getLogin from "../../../../utils/getLogin";
import {isPhoneCheck} from "../../../../utils/deviceCheck";
import {getPublicKeyFromObject} from "../../../../utils/getPublicKey";
import Dividends from "../../../../components/Dividends";
import addressFormat from "../../../../utils/addressFormat";

// @inject('contractsStore') @observer
// todo: move the code fetch data on the upper component
export default class MyWalletCard extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      balance: '-',
      withdrawnVotedVotesAmount: '-',
      activeVotedVotesAmount: '-',
      totalAssets: '-',
      loading: false,
      lastestUnlockTime: null, // todo: rename the variable
      currentWallet: {
        address: null,
        name: null,
        pubKey: {
          x: null,
          y: null
        }
      }
    };

    this.isPhone = isPhoneCheck();

    this.handleUpdateWalletClick = this.handleUpdateWalletClick.bind(this);
    this.extensionLogout = this.extensionLogout.bind(this);
    this.getCurrentWallet = this.getCurrentWallet.bind(this);

    this.hasRun = false;
  }

  // todo: combine
  componentDidMount() {
    const {
      changeVoteState,
      electionContract,
      multiTokenContract,
      profitContractFromExt
    } = this.props;
    if (
      electionContract &&
      multiTokenContract &&
      profitContractFromExt &&
      !this.hasRun
    ) {
      changeVoteState({
        shouldRefreshMyWallet: true
      });
    }

    this.getCurrentWallet();
  }

  getCurrentWallet(useLock = true) {

    NightElfCheck.getInstance().check.then(ready => {
      const nightElf = NightElfCheck.getAelfInstanceByExtension();
      getLogin(nightElf, {appName: APPNAME}, result => {
        console.log('getCurrentWallet: ', result);
        if (result.error) {
          // message.warn(result.message || result.errorMessage.message);
        } else {
          const wallet =  JSON.parse(result.detail);
          this.setState({
            currentWallet: {
              formattedAddress:  addressFormat(wallet.address),
              address: wallet.address,
              name: wallet.name,
              pubKey: getPublicKeyFromObject(wallet.publicKey)
            }
          });
          setTimeout(() => {
            this.handleUpdateWalletClick();
          });
        }
      }, useLock);
    }).catch(() => {
      message.warn('Please download and install NightELF browser extension.');
    });
  }

  // todo: maybe we can fetch the data after all contract are ready as it will reduce the difficulty of code and reduce the code by do the same thing in cdm and cdu
  componentDidUpdate(prevProps) {
    this.fetchData(prevProps);
    if (this.props.currentWallet && !prevProps.currentWallet) {
      this.getCurrentWallet();
    }
  }

  fetchData(prevProps) {
    // todo: optimize the judge
    const {
      multiTokenContract,
      electionContract,
      profitContract,
      electionContractFromExt,
      shouldRefreshMyWallet,
      changeVoteState
    } = this.props;
    const { activeVotedVotesAmount, balance } = this.state;

    if (multiTokenContract !== prevProps.multiTokenContract) {
      this.hasRun = true;
      this.fetchWalletBalance();
    }

    if (electionContract !== prevProps.electionContract && electionContract) {
      this.fetchElectorVoteInfo();
    }

    // todo: maybe we need to use electionContractFromExt instead
    // After get balance and lockAmount, calculate the total assets
    if (
      electionContract &&
      multiTokenContract &&
      activeVotedVotesAmount !== '-' &&
      balance !== '-'
    ) {
      this.computedTotalAssets();
    }

    if (shouldRefreshMyWallet) {
      changeVoteState(
        {
          shouldRefreshMyWallet: false
        },
        () => {
          this.setState({
            loading: true
          });
          this.updateWallet().then(() => {
            this.setState({
              loading: false
            });
          });
        }
      );
    }
  }

  fetchWalletBalance() {
    const { multiTokenContract } = this.props;
    const {currentWallet} = this.state;

    if (!currentWallet || !currentWallet.address) {
      return false;
    }
    return multiTokenContract.GetBalance.call({
      symbol: SYMBOL,
      owner: currentWallet.address
    })
      .then(res => {
        this.setState({
          balance: +res.balance / ELF_DECIMAL
        });
      })
      .catch(err => console.error('fetchWalletBalance', err));
  }

  fetchElectorVoteInfo() {
    const { electionContract } = this.props;

    const {currentWallet} = this.state;

    if (!currentWallet || !currentWallet.address || !electionContract) {
      return false;
    }

    return electionContract.GetElectorVoteWithRecords.call({
      value: currentWallet.pubKey
    })
      .then(res => {
        let { activeVotedVotesAmount } = res;
        const { allVotedVotesAmount, activeVotingRecords } = res;
        if (activeVotedVotesAmount) {
          this.computedLastestUnlockTime(activeVotingRecords);
        }
        activeVotedVotesAmount = +activeVotedVotesAmount;
        const withdrawnVotedVotesAmount =
          allVotedVotesAmount - activeVotedVotesAmount;
        this.setState({
          activeVotedVotesAmount: activeVotedVotesAmount / ELF_DECIMAL,
          withdrawnVotedVotesAmount: withdrawnVotedVotesAmount / ELF_DECIMAL
        });
      })
      .catch(err => {
        console.error('fetchElectorVoteInfo', err);
      });
  }

  computedLastestUnlockTime(activeVotingRecords) {
    const lastestUnlockTimestamp = activeVotingRecords.sort(
      (a, b) => a.unlockTimestamp.seconds - b.unlockTimestamp.seconds
    )[0];

    const lastestUnlockTime = moment
      .unix(lastestUnlockTimestamp.unlockTimestamp.seconds)
      .format('YYYY-MM-DD  HH:mm:ss');
    this.setState({
      lastestUnlockTime
    });
  }

  computedTotalAssets() {
    const { activeVotedVotesAmount, balance } = this.state;
    this.setState({
      totalAssets: activeVotedVotesAmount + balance
    });
  }

  updateWallet() {
    return Promise.all([this.fetchWalletBalance(), this.fetchElectorVoteInfo()])
      .then(() => {
        this.computedTotalAssets();
      })
      .catch(err => {
        console.error('updateWallet', err);
      });
    // this.fetchProfitAmount();
  }

  handleUpdateWalletClick() {
    const { changeVoteState, checkExtensionLockStatus } = this.props;
    checkExtensionLockStatus().then(() => {
      changeVoteState({
        shouldRefreshMyWallet: true
      });
    });
  }

  extensionLogout() {
    const nightElf = NightElfCheck.getAelfInstanceByExtension();
    getLogin(nightElf, {file: 'MyVote.js'}, result => {
      console.log('extensionLogout getLogin: ', result);
      if (result.error && result.error === 200005) {
        message.warn(result.message || result.errorMessage.message);
      } else {
        const {currentWallet} = this.state;
        nightElf.logout({
          appName: APPNAME,
          address: currentWallet.address
        }, (error, result) => {
          // TODO: more refactor actions for login and logout
          message.success('Logout successful, refresh after 3s.', 3, () => {
            localStorage.removeItem('currentWallet');
            window.location.reload();
          });
        }).catch(error => {
          message.error('logout failed');
        });
      }
    }, false);
  }

  render() {
    const { handleDividendClick, dividends } = this.props;
    const {
      balance,
      withdrawnVotedVotesAmount,
      activeVotedVotesAmount,
      totalAssets,
      loading,
      lastestUnlockTime,
      currentWallet
    } = this.state;

    const walletItems = [
      {
        type: 'Total assets',
        value: thousandsCommaWithDecimal(totalAssets)
      },
      {
        type: 'Balance',
        value: thousandsCommaWithDecimal(balance)
      },
      {
        type: 'Claimable profit',
        value: <Dividends className="wallet-dividends" dividends={dividends.total} />,
        extra: (
          <Button
            type="primary"
            size="small"
            shape="round"
            className={'my-wallet-card-body-wallet-content-withdraw-btn'}
            onClick={handleDividendClick}
          >
            Claim
          </Button>
        )
      },
      {
        type: 'Active votes',
        value: thousandsCommaWithDecimal(activeVotedVotesAmount)
      },
      {
        type: 'Redeemed votes',
        value: thousandsCommaWithDecimal(withdrawnVotedVotesAmount)
      },
      {
        type: 'Earliest vote expired time',
        value: thousandsCommaWithDecimal(lastestUnlockTime)
      }
    ];

    return (
      <section className="my-wallet-card">
        <div className="my-wallet-card-header">
          <h2 className="my-wallet-card-header-title">
            <Icon
              type="wallet"
              theme="filled"
              className="card-header-icon"
            />
            My Wallet
          </h2>
          { !this.isPhone && currentWallet && currentWallet.name && <Button
            className="my-wallet-card-header-sync-btn update-btn"
            disabled={!(currentWallet && currentWallet.address)}
            onClick={this.extensionLogout}
          >
            Change Wallet<Icon type="logout"/>
          </Button>}
          <Button
            className="my-wallet-card-header-sync-btn update-btn"
            disabled={!(currentWallet && currentWallet.address)}
            onClick={this.handleUpdateWalletClick}
          >
            Refresh<Icon type="sync" spin={loading} />
          </Button>
          {!(currentWallet && currentWallet.address) && <Button
            className="my-wallet-card-header-sync-btn update-btn"
            onClick={() => this.getCurrentWallet(false)}
          >
            Login
          </Button>}
        </div>
        <div className="my-wallet-card-body-wallet-title">
          {isPhoneCheck() ? <>
              <div>
                <span className="my-wallet-card-body-wallet-title-key">Name: </span>
                <span className="primary-color">{currentWallet.name}</span>
              </div>
              <div>
                <span className="my-wallet-card-body-wallet-title-key">
                  Address:{' '}
                </span>
                <span className="primary-color">
                {currentWallet.formattedAddress}
                </span>
              </div>
            </>
            : <>
              <span className="my-wallet-card-body-wallet-title-key">Name: </span>
              <span className="primary-color">{currentWallet.name}</span>
              <span className="my-wallet-card-body-wallet-title-blank"/>
              <span className="my-wallet-card-body-wallet-title-key">
            Address:{' '}
          </span>
              <span className="primary-color">
            {currentWallet.formattedAddress}
          </span>
            </>
          }

        </div>
        <Spin spinning={loading}>
          <div className="my-wallet-card-body">
            <ul className="my-wallet-card-body-wallet-content">
              {walletItems.map((item,  index) => {
                return (
                  <li key={index}>
                    <span className="item-type">{item.type}:</span>
                    <span className="item-value">{item.value}</span>
                    <span className="item-extra">{item.extra}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Spin>
      </section>
    );
  }
}
