/**
 * @file ResourceMoneyMarket
 * @author zhouminghui
 * A collection of resource transactions
*/


import React, {PureComponent} from 'react';
import {Row, Col} from 'antd';
import ResourceCurrencyChart from './ResourceCurrencyChart/ResourceCurrencyChart';
import ResourceTrading from './ResourceTrading/ResourceTrading';
import RealTimeTransactions from './RealTimeTransactions/RealTimeTransactions';
import './ResourceMoneyMarket.less';

export default class ResourceMoneyMarket extends PureComponent {
    constructor(props) {
        super(props);
        // 这个组件作为一个集合可以用作组件之间数据交互
        this.state = {
            menuIndex: 0,
            currentWallet: this.props.currentWallet,
            voteContracts: this.props.voteContracts
        };
    }

    getMenuClick(index) {
        // TODO 切换所有模块数据源  写一个状态判断用来判断当前是哪一个数据
        this.setState({
            menuIndex: index
        });
    }

    componentDidMount() {
        // TODO 数据加载
    }

    static getDerivedStateFromProps(props, state) {
        if (props.currentWallet !== state.currentWallet) {
            return {
                currentWallet: props.currentWallet
            };
        }

        return null;
    } 

    getMenuHTML() {
        const menuNames = ['RAM', 'CPU', 'NET', 'STO'];
        const {menuIndex} = this.state;
        const menu = menuNames.map((item, index) => {
                if (index !== menuIndex) {
                    return (
                        <Col xxl={24} xl={24} lg={6} key={index} style={{marginBottom: '80px'}} >
                            <div className='menu-button' onClick={this.getMenuClick.bind(this, index)}>
                                {item}
                            </div>
                        </Col>
                    );
                }
                return (
                    <Col xxl={24} xl={24} lg={6} key={index} style={{marginBottom: '80px'}} >
                        <div className='menu-button'
                            onClick={this.getMenuClick.bind(this, index)}
                            style={{background: '#195aa7'}}
                        >
                            {item}
                        </div>
                    </Col>
                );
            }
        );
        return menu;
    }

    render() {
        const menu = this.getMenuHTML();
        const {menuIndex, currentWallet, voteContracts} = this.state;
        return (
            <div className='resource-market-body'>
                <div className='resource-head'>
                    Resource Money Market
                </div>
                <div className='resource-body'>
                    <Row>
                        <Col xxl={4} xl={4} lg={24}>
                            <Row>
                                {menu}
                            </Row>
                        </Col>
                        <Col xxl={20} xl={20} lg={24}>
                            <ResourceCurrencyChart
                                menuIndex={menuIndex}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col
                            xxl={14}
                            xl={24}
                            lg={24}
                        >
                            <ResourceTrading
                                menuIndex={menuIndex}
                                currentWallet={currentWallet}
                                voteContracts={voteContracts}
                            />
                        </Col>
                        <Col
                            xxl={{span: 8, offset: 2}}
                            xl={24}
                            lg={24}
                        >
                            <RealTimeTransactions
                                menuIndex={menuIndex}
                            />
                        </Col>
                    </Row>
                </div>
            </div>
        );
    }
}
