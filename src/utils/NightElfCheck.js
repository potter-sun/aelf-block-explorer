/**
 * @file NightElfCheck
 * @author zhouminghui
 */
import NightElfCheckTemp from './NightElf/NightElfCheck';
import AelfBridgeCheck from './NightElf/AelfBridgeCheck';
import isMobile from 'ismobilejs';

const isPhone = isMobile(window.navigator).phone;

const NightElfCheck = isPhone ? AelfBridgeCheck : NightElfCheckTemp;
// const NightElfCheck = NightElfCheckTemp;
export default NightElfCheck;
export const getViewResult = (key, result) => {
    if (!result) {
        return undefined;
    }
    return result[key] || (result.result && result.result[key]);
};
