import React, { Component } from 'react';
import moment from 'moment';

import StatisticalData from '@components/StatisticalData/';
import {ELF_DECIMAL, myVoteStatisData} from '../constants';
import MyVoteRecord from './MyVoteRecords';
import { getAllTeamDesc, fetchPageableCandidateInformation } from '@api/vote';
import publicKeyToAddress from '@utils/publicKeyToAddress';
import {
  RANK_NOT_EXISTED_SYMBOL
} from '@src/pages/Vote/constants';
import { MY_VOTE_DATA_TIP } from '@src/constants';
import NightElfCheck from "../../../utils/NightElfCheck";
import getLogin from "../../../utils/getLogin";
import {message, Spin} from "antd";
import {getPublicKeyFromObject} from "../../../utils/getPublicKey";
import addressFormat from "../../../utils/addressFormat";

export default class MyVote extends Component {
  constructor(props) {
    super(props);
    this.state = {
      statisData: myVoteStatisData,
      tableData: [],
      spinningLoading: true,
      currentWallet: {
        address: null,
        name: null,
        pubKey: {
          x: null,
          y: null
        }
      }
    };

    this.hasRun = false;
  }

  componentDidMount() {
    this.getCurrentWallet();
  }

  // todo: update the vote info after switch to this tab
  componentDidUpdate(prevProps, prevState) {
    if (!this.hasRun) {
      this.fetchTableDataAndStatisData();
    }
  }
  getCurrentWallet() {
    NightElfCheck.getInstance().check.then(ready => {
      const nightElf = NightElfCheck.getAelfInstanceByExtension();
      getLogin(nightElf, {file: 'MyVote.js'}, result => {
        if (result.error) {
          this.setState({
            spinningLoading: false
          });
          // message.warn(result.message || result.errorMessage.message);
        } else {
          const wallet =  JSON.parse(result.detail);
          const currentWallet = {
            formattedAddress:  addressFormat(wallet.address),
            address: wallet.address,
            name: wallet.name,
            pubKey: getPublicKeyFromObject(wallet.publicKey)
          };
          this.setState({
            currentWallet
          });
          setTimeout(() => {
            this.fetchTableDataAndStatisData(currentWallet);
          });
        }
      }, false);
    }).catch(error => {
      this.setState({
        spinningLoading: false
      });
      // message.warn('Please download and install NightELF browser extension.');
    });
  }

  fetchTableDataAndStatisData(currentWalletTemp) {
    const { electionContract } = this.props;
    if (!electionContract) return;
    this.hasRun = true;
    const currentWallet = currentWalletTemp || this.state.currentWallet;
    // console.log('fetchTableDataAndStatisData: ', currentWallet);
    if (!currentWallet || !currentWallet.address) {
      this.hasRun = false;
      return false;
    }

    // todo: is it ok to get the same data twice in different tabs
    // todo: add error handle
    Promise.all([
      electionContract.GetElectorVoteWithAllRecords.call({
        value: currentWallet.pubKey
      }),
      getAllTeamDesc(),
      fetchPageableCandidateInformation(electionContract, {
        start: 0,
        // length: A_NUMBER_LARGE_ENOUGH_TO_GET_ALL // FIXME:
        length: 5
      })
    ])
      .then(resArr => {
        console.log('resArr', resArr);
        this.processData(resArr);
      })
      .catch(err => {
        console.error('err', 'fetchTableDataAndStatisData', err);
      });
  }

  processData(resArr) {
    const electorVotes = resArr[0];
    const allNodeInfo = (resArr[2] ? resArr[2].value : [])
      .sort((a, b) => +b.obtainedVotesAmount - +a.obtainedVotesAmount)
      .map((item, index) => {
        item.rank = index + 1;
        return item;
      });
    let allTeamInfo = null;
    const withdrawnableVoteRecords = [];
    let withdrawnableVoteAmount = 0;
    if (resArr[1].code === 0) {
      allTeamInfo = resArr[1].data;
    }

    const myVoteRecords = [
      ...electorVotes.activeVotingRecords,
      ...electorVotes.withdrawnVotesRecords
    ];
    electorVotes.activeVotingRecords.forEach(record => {
      if (record.unlockTimestamp.seconds < moment().unix()) {
        withdrawnableVoteRecords.push(record);
      }
    });

    // assign rank
    myVoteRecords.forEach(record => {
      const foundedNode = allNodeInfo.find(
        item => item.candidateInformation.pubkey === record.candidate
      );
      if (foundedNode === undefined) {
        // rank: used to sort
        record.rank = 9999999;
        // displayedRank: used to display
        record.displayedRank = RANK_NOT_EXISTED_SYMBOL;
      } else {
        record.rank = foundedNode.rank;
        record.displayedRank = foundedNode.rank;
      }
    });
    const myTotalVotesAmount = electorVotes.allVotedVotesAmount;
    withdrawnableVoteAmount = withdrawnableVoteRecords.reduce(
      (total, current) => total + +current.amount,
      0
    );
    console.log({
      myTotalVotesAmount,
      withdrawnableVoteAmount
    });
    this.processStatisData('myTotalVotesAmount', 'num', myTotalVotesAmount / ELF_DECIMAL);
    this.processStatisData(
      'withdrawnableVotesAmount',
      'num',
      withdrawnableVoteAmount / ELF_DECIMAL
    );
    this.processTableData(myVoteRecords, allTeamInfo);
  }

  // eslint-disable-next-line class-methods-use-this
  processTableData(myVoteRecords, allTeamInfo) {
    // add node name
    const tableData = myVoteRecords;
    tableData.forEach(record => {
      const teamInfo = allTeamInfo.find(
        team => team.public_key === record.candidate
      );
      console.log('teamInfo', teamInfo);
      if (teamInfo === undefined) {
        record.address = publicKeyToAddress(record.candidate);
        record.name = addressFormat(record.address);
      } else {
        record.name = teamInfo.name;
      }
      if (record.isWithdrawn) {
        record.type = 'Redeem';
        record.operationTime = moment
          .unix(record.withdrawTimestamp.seconds)
          .format('YYYY-MM-DD HH:mm:ss');
      } else if (record.isChangeTarget) {
        record.type = 'Switch Vote';
        record.operationTime = moment
          .unix(record.voteTimestamp.seconds)
          .format('YYYY-MM-DD HH:mm:ss');
      } else {
        record.type = 'Vote';
        record.operationTime = moment
          .unix(record.voteTimestamp.seconds)
          .format('YYYY-MM-DD HH:mm:ss');
      }
      record.status = 'Success';
      console.log('record.lockTime', record.lockTime);
      const start = moment.unix(record.voteTimestamp.seconds);
      const end = moment.unix(record.unlockTimestamp.seconds);
      record.formatedLockTime = end.from(start, true);
      record.formatedUnlockTime = end.format('YYYY-MM-DD HH:mm:ss');
      record.isRedeemable = record.unlockTimestamp.seconds <= moment().unix();
    });
    // todo: withdrawn's timestamp

    this.setState({
      tableData,
      spinningLoading: false
    });
  }

  processStatisData(key, param, value) {
    let { statisData } = this.state;
    statisData[key][param] = value;
    // todo: Is it required?
    statisData = { ...statisData };
    this.setState({
      statisData,
      spinningLoading: false
    });
  }

  render() {
    const { statisData, spinningLoading, tableData } = this.state;

    return (
      <section>
        <Spin spinning={spinningLoading}>
          <StatisticalData data={statisData} tooltip={MY_VOTE_DATA_TIP} />
          <MyVoteRecord data={tableData} />
        </Spin>
      </section>
    );
  }
}
