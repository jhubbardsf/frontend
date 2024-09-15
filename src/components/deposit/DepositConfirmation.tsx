import {
    Tabs,
    TabList,
    Tooltip,
    TabPanels,
    Tab,
    Button,
    Flex,
    Text,
    useColorModeValue,
    Box,
    Spacer,
    Input,
    useDisclosure,
    ModalFooter,
    ModalOverlay,
    ModalContent,
    Modal,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
} from '@chakra-ui/react';
import useWindowSize from '../../hooks/useWindowSize';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef, ChangeEvent, use } from 'react';
import styled from 'styled-components';
import { colors } from '../../utils/colors';
import { BTCSVG, ETHSVG, InfoSVG } from '../other/SVGs';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSwitchChain, useWalletClient } from 'wagmi';
import {
    ethToWei,
    weiToEth,
    btcToSats,
    findVaultIndexToOverwrite,
    findVaultIndexWithSameExchangeRate,
    satsToBtc,
    bufferTo18Decimals,
    convertToBitcoinLockingScript,
} from '../../utils/dappHelper';
import riftExchangeABI from '../../abis/RiftExchange.json';
import { BigNumber, ethers } from 'ethers';
import { useStore } from '../../store';
import { FONT_FAMILIES } from '../../utils/font';
import { DepositStatus, useDepositLiquidity } from '../../hooks/contract/useDepositLiquidity';
import DepositStatusModal from './DepositStatusModal';
import WhiteText from '../other/WhiteText';
import OrangeText from '../other/OrangeText';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { bitcoinDecimals } from '../../utils/constants';
import { CheckCircleIcon, CheckIcon, ChevronLeftIcon, SettingsIcon } from '@chakra-ui/icons';
import { HiOutlineXCircle, HiXCircle } from 'react-icons/hi';
import { IoCheckmarkDoneCircle } from 'react-icons/io5';
import { IoMdCheckmarkCircle } from 'react-icons/io';
import { AssetTag } from '../other/AssetTag';
import { FaRegArrowAltCircleRight } from 'react-icons/fa';

type ActiveTab = 'swap' | 'liquidity';

export const DepositConfirmation = ({}) => {
    const { isMobile } = useWindowSize();
    const router = useRouter();
    const fontSize = isMobile ? '20px' : '20px';

    const { openConnectModal } = useConnectModal();
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { chains, error, switchChain } = useSwitchChain();
    const { data: walletClient } = useWalletClient();
    const { depositLiquidity, status: depositLiquidityStatus, error: depositLiquidityError, txHash, resetDepositState } = useDepositLiquidity();
    const ethersRpcProvider = useStore((state) => state.ethersRpcProvider);
    const bitcoinPriceUSD = useStore((state) => state.bitcoinPriceUSD);
    const setBitcoinPriceUSD = useStore((state) => state.setBitcoinPriceUSD);
    const setShowManageDepositVaultsScreen = useStore((state) => state.setShowManageDepositVaultsScreen);
    const selectedInputAsset = useStore((state) => state.selectedInputAsset);
    const setSelectedInputAsset = useStore((state) => state.setSelectedInputAsset);

    const usdtDepositAmount = useStore((state) => state.usdtDepositAmount);
    const setUsdtDepositAmount = useStore((state) => state.setUsdtDepositAmount);
    const btcOutputAmount = useStore((state) => state.btcOutputAmount);
    const setBtcOutputAmount = useStore((state) => state.setBtcOutputAmount);

    const [usdtDepositAmountUSD, setUsdtDepositAmountUSD] = useState('0.00');

    const [profitPercentage, setProfitPercentage] = useState('');
    const [profitAmountUSD, setProfitAmountUSD] = useState('0.00');

    const [bitcoinOutputAmountUSD, setBitcoinOutputAmountUSD] = useState('0.00');

    const [payoutBTCAddress, setPayoutBTCAddress] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isWaitingForConnection, setIsWaitingForConnection] = useState(false);
    const [isWaitingForCorrectNetwork, setIsWaitingForCorrectNetwork] = useState(false);
    const usdtPriceUSD = useStore.getState().validAssets[selectedInputAsset.name].priceUSD;
    const [editExchangeRateMode, setEditExchangeRateMode] = useState(false);
    const setDepositFlowState = useStore((state) => state.setDepositFlowState);
    const actualBorderColor = '#323232';
    const borderColor = `2px solid ${actualBorderColor}`;
    const { isOpen, onOpen, onClose } = useDisclosure();
    const setBtcInputSwapAmount = useStore((state) => state.setBtcInputSwapAmount);
    const usdtOutputSwapAmount = useStore((state) => state.usdtOutputSwapAmount);
    const setUsdtOutputSwapAmount = useStore((state) => state.setUsdtOutputSwapAmount);

    useEffect(() => {
        if (isWaitingForConnection && isConnected) {
            setIsWaitingForConnection(false);
            proceedWithDeposit();
        }

        if (isWaitingForCorrectNetwork && chainId === selectedInputAsset.contractChainID) {
            setIsWaitingForCorrectNetwork(false);
            proceedWithDeposit();
        }
    }, [isConnected, isWaitingForConnection, chainId, isWaitingForCorrectNetwork]);

    // calculate profit amount in USD
    useEffect(() => {
        const profitAmountUSD = `${(((parseFloat(usdtDepositAmount) * parseFloat(profitPercentage)) / 100) * (usdtPriceUSD ?? 0)).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
        })}`;

        setProfitAmountUSD(!profitPercentage || !usdtDepositAmount || profitPercentage == '-' ? '$0.00' : profitAmountUSD);
    }, [usdtDepositAmount, profitPercentage]);

    // calculate deposit amount in USD
    useEffect(() => {
        const usdtDepositAmountUSD =
            usdtPriceUSD && usdtDepositAmount
                ? (usdtPriceUSD * parseFloat(usdtDepositAmount)).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                  })
                : '$0.00';
        setUsdtDepositAmountUSD(usdtDepositAmountUSD);
    }, [usdtDepositAmount]);

    useEffect(() => {
        console.log('IS CONNECTED:', isConnected);
    }, [isConnected]);

    // calculate Bitcoin output amount in USD
    useEffect(() => {
        console.log('bitcoinPriceUSD:', bitcoinPriceUSD);
        const bitcoinOutputAmountUSD =
            bitcoinPriceUSD && btcOutputAmount
                ? (bitcoinPriceUSD * parseFloat(btcOutputAmount)).toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'USD',
                  })
                : '$0.00';
        setBitcoinOutputAmountUSD(bitcoinOutputAmountUSD);
    }, [btcOutputAmount]);

    // ---------- DEPOSIT TOKEN AMOUNT ---------- //
    const handleTokenDepositChange = (e: ChangeEvent<HTMLInputElement>) => {
        const maxDecimals = useStore.getState().validAssets[selectedInputAsset.name].decimals;
        const tokenValue = e.target.value;

        const validateTokenDepositChange = (value: string) => {
            if (value === '') return true;
            const regex = new RegExp(`^\\d*\\.?\\d{0,${maxDecimals}}$`);
            return regex.test(value);
        };

        if (validateTokenDepositChange(tokenValue)) {
            setUsdtDepositAmount(tokenValue);
            calculateBitcoinOutputAmount(tokenValue, undefined);
        }
    };

    // ---------- PROFIT PERCENTAGE ---------- //
    const handleProfitPercentageChange = (e: ChangeEvent<HTMLInputElement>) => {
        const profitPercentageValue = e.target.value.replace('%', '');

        if (validateProfitPercentage(profitPercentageValue)) {
            setProfitPercentage(profitPercentageValue);
            calculateBitcoinOutputAmount(undefined, profitPercentageValue);
        } else {
            console.log('Invalid profit percentage');
        }
    };

    const handleProfitPercentageFocus = (value: string) => {
        // remove percentage sign and plus/minus sign on focus
        let ProfitPercentageValue = value.replace('%', '').replace(/^\+/, '');
        setProfitPercentage(ProfitPercentageValue);
    };

    const handleProfitPercentageBlur = () => {
        // add percentage sign and plus/minus sign on blur
        if (profitPercentage === '-') setProfitPercentage('');
        else if (profitPercentage !== '') {
            let formattedProfitPercentage = profitPercentage;
            if (!formattedProfitPercentage.endsWith('%')) {
                if (!formattedProfitPercentage.startsWith('-') && /^[0-9]/.test(formattedProfitPercentage)) {
                    // Check if it's numeric and not negative
                    formattedProfitPercentage = '+' + formattedProfitPercentage;
                }
                formattedProfitPercentage += '%';
            }
            setProfitPercentage(formattedProfitPercentage);
        }
    };

    const calculateProfitPercent = (bitcoinAmount: string) => {
        const startValue = parseFloat(usdtDepositAmount);
        const endValue = parseFloat(bitcoinAmount) * useStore.getState().validAssets[selectedInputAsset.name].exchangeRateInTokenPerBTC;

        const newProfitPercentage = (((endValue - startValue) / startValue) * 100).toFixed(2);
        if (validateProfitPercentage(newProfitPercentage)) {
            let formattedProfitPercentage = newProfitPercentage;
            if (!formattedProfitPercentage.startsWith('-') && /^[0-9]/.test(formattedProfitPercentage)) {
                // Check if it's numeric and not negative
                formattedProfitPercentage = '+' + formattedProfitPercentage;
            }
            formattedProfitPercentage += '%';
            setProfitPercentage(formattedProfitPercentage);
        }
    };

    const validateProfitPercentage = (value) => {
        // max 2 decimal places and optional minus sign
        if (value === '') return true;
        const regex = /^-?\d*(\.\d{0,2})?$/;
        return regex.test(value);
    };

    // ---------- BITCOIN OUTPUT AMOUNT ---------- //
    const handleBitcoinOutputAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
        const bitcoinOutputAmountValue = e.target.value;

        if (validateBitcoinOutputAmount(bitcoinOutputAmountValue)) {
            setBtcOutputAmount(bitcoinOutputAmountValue === '0.0' ? '' : bitcoinOutputAmountValue);
            calculateProfitPercent(bitcoinOutputAmountValue);
        }
    };

    const calculateBitcoinOutputAmount = (newEthDepositAmount: string | undefined, newProfitPercentage: string | undefined) => {
        if (usdtPriceUSD && bitcoinPriceUSD) {
            console.log('newProfitPercentage:', newProfitPercentage);
            const profitAmountInToken = parseFloat(newEthDepositAmount ?? usdtDepositAmount) * (parseFloat(newProfitPercentage ?? profitPercentage) / 100);
            const totalTokenUSD = parseFloat(newEthDepositAmount ?? usdtDepositAmount) * usdtPriceUSD + profitAmountInToken * usdtPriceUSD;
            const newBitcoinOutputAmount = totalTokenUSD / bitcoinPriceUSD > 0 ? totalTokenUSD / bitcoinPriceUSD : 0;
            const formattedBitcoinOutputAmount = newBitcoinOutputAmount == 0 ? '0.0' : newBitcoinOutputAmount.toFixed(7);

            if (validateBitcoinOutputAmount(formattedBitcoinOutputAmount)) {
                setBtcOutputAmount(formattedBitcoinOutputAmount === '0.0' ? '' : formattedBitcoinOutputAmount);
            }
            // Calculate the profit amount in USD

            const profitAmountUSD = `${(((parseFloat(usdtDepositAmount) * parseFloat(newProfitPercentage ?? profitPercentage)) / 100) * usdtPriceUSD).toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
            })}`;
            setProfitAmountUSD(profitAmountUSD);

            // Calculate and update the deposit amount in USD
            console.log('tokenDepositAmount:', usdtDepositAmount);
            const usdtDepositAmountUSD =
                usdtPriceUSD && usdtDepositAmount
                    ? (usdtPriceUSD * parseFloat(usdtDepositAmount)).toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'USD',
                      })
                    : '$0.00';
            setUsdtDepositAmountUSD(usdtDepositAmountUSD);
        }
    };

    const validateBitcoinOutputAmount = (value: string) => {
        if (value === '') return true;
        const regex = /^\d*\.?\d*$/;
        return regex.test(value);
    };

    // ---------- BTC PAYOUT ADDRESS ---------- //
    const handleBTCPayoutAddressChange = (e) => {
        const BTCPayoutAddress = e.target.value;
        setPayoutBTCAddress(BTCPayoutAddress);
    };

    const validateBitcoinPayoutAddress = (address: string): boolean => {
        const p2pkhRegex = /^[1][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // P2PKH addresses start with 1
        const p2shRegex = /^[3][a-km-zA-HJ-NP-Z1-9]{25,34}$/; // P2SH addresses start with 3
        const bech32Regex = /^bc1q[a-zA-HJ-NP-Z0-9]{14,74}$/; // Bech32 addresses (SegWit) start with bc1q
        const taprootRegex = /^bc1p[a-zA-HJ-NP-Z0-9]{14,74}$/; // Taproot addresses start with bc1p

        return p2pkhRegex.test(address) || p2shRegex.test(address) || bech32Regex.test(address) || taprootRegex.test(address);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        if (depositLiquidityStatus === DepositStatus.Confirmed) {
            setUsdtDepositAmount('');
            setBtcInputSwapAmount('');
            setUsdtOutputSwapAmount('');
            setBtcOutputAmount('');

            setDepositFlowState('0-not-started');
        }
    };

    const BitcoinAddressValidation: React.FC<{ address: string }> = ({ address }) => {
        const isValid = validateBitcoinPayoutAddress(address);

        if (address.length === 0) {
            return <Text>...</Text>;
        }

        return (
            <Flex align='center' fontFamily={FONT_FAMILIES.NOSTROMO} w='50px' ml='-10px' mr='0px' h='100%' justify='center' direction='column'>
                {isValid ? (
                    <>
                        <IoMdCheckmarkCircle color='green' size={'24px'} />
                        <Text fontSize={'10px'} mt='3px' color='green'>
                            Valid
                        </Text>
                    </>
                ) : (
                    <>
                        <HiXCircle color='red' size={'24px'} />
                        <Text fontSize={'10px'} mt='3px' color='red'>
                            Invalid
                        </Text>
                    </>
                )}
            </Flex>
        );
    };
    // ---------- DEPOSIT ---------- //

    const initiateDeposit = async () => {
        if (!isConnected) {
            setIsWaitingForConnection(true);
            openConnectModal();
            return;
        }

        if (chainId !== selectedInputAsset.contractChainID) {
            console.log('Switching network');
            setIsWaitingForCorrectNetwork(true);
            switchChain({ chainId: selectedInputAsset.contractChainID });
            return;
        }

        proceedWithDeposit();
    };

    const proceedWithDeposit = async () => {
        if (window.ethereum) {
            // Reset the deposit state before starting a new deposit
            resetDepositState();
            setIsModalOpen(true);

            const vaultIndexToOverwrite = findVaultIndexToOverwrite();
            const vaultIndexWithSameExchangeRate = findVaultIndexWithSameExchangeRate();
            const tokenDecmials = useStore.getState().validAssets[selectedInputAsset.name].decimals;
            const tokenDepositAmountInSmallestTokenUnits = parseUnits(usdtDepositAmount, tokenDecmials);
            const tokenDepositAmountInSmallestTokenUnitsBufferedTo18Decimals = bufferTo18Decimals(tokenDepositAmountInSmallestTokenUnits, tokenDecmials);
            const bitcoinOutputAmountInSats = parseUnits(btcOutputAmount, bitcoinDecimals);
            console.log('bitcoinOutputAmountInSats:', bitcoinOutputAmountInSats.toString());
            const exchangeRate = tokenDepositAmountInSmallestTokenUnitsBufferedTo18Decimals.div(bitcoinOutputAmountInSats);

            const clipToDecimals = bitcoinDecimals; // Calculate how many decimals to clip to
            const precisionBN = BigNumber.from(10).pow(clipToDecimals); // Calculate precision

            const clippedExchangeRate = exchangeRate.div(precisionBN).mul(precisionBN);

            const bitcoinPayoutLockingScript = convertToBitcoinLockingScript(payoutBTCAddress);

            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();

            await depositLiquidity({
                signer: signer,
                riftExchangeAbi: selectedInputAsset.riftExchangeAbi,
                riftExchangeContractAddress: selectedInputAsset.riftExchangeContractAddress,
                tokenAddress: selectedInputAsset.tokenAddress,
                btcPayoutLockingScript: bitcoinPayoutLockingScript,
                btcExchangeRate: clippedExchangeRate,
                vaultIndexToOverwrite,
                tokenDepositAmountInSmallestTokenUnits: tokenDepositAmountInSmallestTokenUnits,
                vaultIndexWithSameExchangeRate,
            });
        }
    };

    return (
        <Flex
            w='100%'
            h='100%'
            flexDir={'column'}
            userSelect={'none'}
            fontSize={'12px'}
            fontFamily={FONT_FAMILIES.AUX_MONO}
            color={'#c3c3c3'}
            fontWeight={'normal'}
            overflow={'visible'}
            gap={'0px'}>
            <Flex w='100%' mt='-10px' mb='-35px' ml='0px' overflow={'visible'}>
                <Button bg={'none'} w='12px' overflow={'visible'} _hover={{ bg: colors.borderGray }} onClick={() => setDepositFlowState('0-not-started')}>
                    <ChevronLeftIcon overflow={'visible'} width={'36px'} height={'40px'} bg='none' color={colors.offWhite} />
                </Button>
            </Flex>
            <Text align='center' w='100%' mb='24px' fontSize='21px' fontFamily={FONT_FAMILIES.NOSTROMO} color={colors.offWhite}>
                CREATE DEPOSIT VAULT
            </Text>
            <Text justifyContent='center' w='100%' fontSize={'13px'} letterSpacing={'-1px'} textAlign={'center'}>
                Create a sell order deposit vault, get payed out in
                <OrangeText> BTC</OrangeText> when your order is filled by a buyer. Withdraw unreserved liquidity anytime.
            </Text>

            <Flex mt='20px' direction={'column'} overflow={'visible'}>
                {/* Content */}
                <Flex direction='column' align='center' overflow={'visible'}>
                    <Flex w='100%' overflow={'visible'} direction={'column'}>
                        {/* SWAP INPUT & SWAP OUTPUT */}
                        <Flex w='100%' mb='20px'>
                            <Flex w='47%' direction='column'>
                                <Text ml='8px' w='100%' fontSize='14px' fontFamily={FONT_FAMILIES.NOSTROMO} color={colors.offWhite}>
                                    Input
                                </Text>
                                <Flex
                                    h='50px'
                                    mt='6px'
                                    w='100%'
                                    bg={selectedInputAsset.dark_bg_color}
                                    border='3px solid'
                                    borderColor={selectedInputAsset.bg_color}
                                    borderRadius={'14px'}
                                    pl='15px'
                                    pr='10px'
                                    align={'center'}>
                                    <Text fontSize='16px' color={colors.offWhite} letterSpacing={'-1px'} fontFamily={FONT_FAMILIES.AUX_MONO}>
                                        {usdtDepositAmount}
                                    </Text>
                                    <Spacer />
                                    <AssetTag assetName={selectedInputAsset.name} width='84px' />
                                </Flex>
                            </Flex>
                            <Text
                                mt='46px'
                                px='10px'
                                fontSize='20px'
                                opacity={0.9}
                                fontWeight={'bold'}
                                color={colors.offWhite}
                                letterSpacing={'-1px'}
                                fontFamily={FONT_FAMILIES.AUX_MONO}>
                                <FaRegArrowAltCircleRight color={colors.RiftOrange} />
                            </Text>
                            <Spacer />

                            <Flex w='47%' direction='column'>
                                <Text ml='8px' w='100%' fontSize='14px' fontFamily={FONT_FAMILIES.NOSTROMO} color={colors.offWhite}>
                                    Output
                                </Text>
                                <Flex
                                    h='50px'
                                    mt='6px'
                                    w='100%'
                                    bg='#2E1C0C'
                                    border={'3px solid'}
                                    borderColor={'#78491F'}
                                    borderRadius={'14px'}
                                    pl='15px'
                                    pr='10px'
                                    align={'center'}>
                                    <Text fontSize='16px' color={colors.offWhite} letterSpacing={'-1px'} fontFamily={FONT_FAMILIES.AUX_MONO}>
                                        {btcOutputAmount}
                                    </Text>

                                    <Spacer />
                                    <AssetTag assetName={'BTC'} width='80px' />
                                </Flex>
                            </Flex>
                        </Flex>
                        {/* Profit Percentage Input */}
                        {!editExchangeRateMode ? (
                            <></>
                        ) : (
                            <Flex mt='10px' px='10px' bg='#161A33' w='100%' h='105px' border='2px solid #303F9F' borderRadius={'10px'}>
                                <Flex direction={'column'} py='10px' px='5px'>
                                    <Text
                                        color={!profitPercentage ? colors.offWhite : colors.textGray}
                                        fontSize={'13px'}
                                        letterSpacing={'-1px'}
                                        fontWeight={'normal'}
                                        fontFamily={'Aux'}>
                                        Your Profit %
                                    </Text>
                                    <Input
                                        value={profitPercentage}
                                        onChange={(e) => {
                                            handleProfitPercentageChange(e);
                                        }}
                                        onBlur={handleProfitPercentageBlur}
                                        onFocus={() => handleProfitPercentageFocus(profitPercentage)}
                                        fontFamily={'Aux'}
                                        border='none'
                                        mt='2px'
                                        mr='-120px'
                                        ml='-5px'
                                        p='0px'
                                        letterSpacing={'-6px'}
                                        color={colors.offWhite}
                                        _active={{ border: 'none', boxShadow: 'none' }}
                                        _focus={{ border: 'none', boxShadow: 'none' }}
                                        _selected={{ border: 'none', boxShadow: 'none' }}
                                        fontSize='40px'
                                        placeholder='0.0'
                                        _placeholder={{ color: '#5C63A3' }}
                                    />
                                    <Text
                                        color={!profitPercentage ? colors.offWhite : colors.textGray}
                                        fontSize={'13px'}
                                        mt='2px'
                                        ml='1px'
                                        letterSpacing={'-1px'}
                                        fontWeight={'normal'}
                                        fontFamily={'Aux'}>
                                        ≈ {profitAmountUSD}
                                    </Text>
                                </Flex>
                                <Spacer />
                                <Flex
                                    alignSelf={'center'}
                                    mr='6px'
                                    w='220px'
                                    h='60px'
                                    bg='#222753'
                                    fontSize={'12px'}
                                    align='center'
                                    letterSpacing={'-1px'}
                                    justify='center'
                                    border='2px solid #3C4ABB'
                                    borderRadius={'10px'}
                                    textAlign='center'
                                    direction='column'>
                                    <Text color={colors.offWhite}>Your Exchange Rate</Text>
                                    <Text>
                                        1 BTC = {/* amount of deposit asset / amount of BTC out ) * deposit asset price in USD */}
                                        {usdtDepositAmount && btcOutputAmount
                                            ? ((parseFloat(usdtDepositAmount) / parseFloat(btcOutputAmount)) * usdtPriceUSD).toLocaleString('en-US', {
                                                  style: 'currency',
                                                  currency: 'USD',
                                              })
                                            : '$0.00'}{' '}
                                        {selectedInputAsset.name}
                                    </Text>
                                </Flex>
                            </Flex>
                        )}
                        {/* BTC Payout Address */}
                        <Text ml='8px' mt='5px' w='100%' mb='10px' fontSize='14px' fontFamily={FONT_FAMILIES.NOSTROMO} color={colors.offWhite}>
                            Bitcoin Payout Address
                        </Text>
                        <Flex mt='-2px' px='10px' bg='#111' border='2px solid #565656' w='100%' h='60px' borderRadius={'10px'}>
                            <Flex direction={'row'} py='6px' px='5px'>
                                <Input
                                    value={payoutBTCAddress}
                                    onChange={handleBTCPayoutAddressChange}
                                    fontFamily={'Aux'}
                                    border='none'
                                    mt='3.5px'
                                    mr='20px'
                                    ml='-4px'
                                    p='0px'
                                    w='640px'
                                    letterSpacing={'-6px'}
                                    color={colors.offWhite}
                                    _active={{ border: 'none', boxShadow: 'none' }}
                                    _focus={{ border: 'none', boxShadow: 'none' }}
                                    _selected={{ border: 'none', boxShadow: 'none' }}
                                    fontSize='28px'
                                    placeholder='bc1q5d7rjq7g6rd2d94ca69...'
                                    _placeholder={{ color: colors.darkerGray }}
                                    spellCheck={false}
                                />

                                {payoutBTCAddress.length > 0 && (
                                    <Flex ml='-5px'>
                                        <BitcoinAddressValidation address={payoutBTCAddress} />
                                    </Flex>
                                )}
                            </Flex>
                        </Flex>

                        <Flex
                            alignSelf={'center'}
                            bg='none'
                            w='150px'
                            h='28px'
                            align={'center'}
                            justify={'center'}
                            mt='10px'
                            gap={'5px'}
                            cursor={'pointer'}
                            _hover={{ textDecoration: 'underline' }}
                            fontSize={'8.5px'}
                            color={colors.textGray}
                            onClick={onOpen}>
                            <Flex mt='-2px'>
                                <SettingsIcon />
                            </Flex>{' '}
                            Advanced Settings
                        </Flex>

                        {/* Advanced Settings Modal */}
                        <Modal isOpen={isOpen} onClose={onClose}>
                            <ModalOverlay />
                            <ModalContent bg={colors.offBlackLighter} minW='700px' mx='auto' my='auto' borderRadius={'20px'} alignItems='center' border={borderColor}>
                                <ModalHeader color={colors.offWhite} fontFamily={FONT_FAMILIES.NOSTROMO}>
                                    Advanced Settings
                                </ModalHeader>
                                <ModalCloseButton color={colors.offWhite} />
                                <ModalBody w='100%'>
                                    <Flex
                                        w='100%'
                                        h='100%'
                                        px='30px'
                                        py='8px'
                                        flexDir={'column'}
                                        userSelect={'none'}
                                        fontSize={'12px'}
                                        fontFamily={FONT_FAMILIES.AUX_MONO}
                                        color={'#c3c3c3'}
                                        fontWeight={'normal'}
                                        gap={'0px'}>
                                        <Text fontSize={'13px'} letterSpacing={'-1px'} textAlign={'center'}>
                                            Create a sell order by setting your <WhiteText>Exchange Rate</WhiteText>. Get payed out in
                                            <OrangeText> BTC</OrangeText> when your order is filled. Withdraw unreserved liquidity anytime.
                                        </Text>
                                        <Flex mt='25px' direction={'column'} overflow={'visible'}>
                                            {/* Content */}
                                            <Flex direction='column' align='center' overflow={'visible'}>
                                                <Flex w='100%' overflow={'visible'} direction={'column'}>
                                                    {/* Deposit Input */}
                                                    <Flex
                                                        mt='0px'
                                                        px='10px'
                                                        bg={selectedInputAsset.dark_bg_color}
                                                        w='100%'
                                                        h='105px'
                                                        border='2px solid'
                                                        borderColor={selectedInputAsset.bg_color}
                                                        borderRadius={'10px'}>
                                                        <Flex direction={'column'} py='10px' px='5px'>
                                                            <Text
                                                                color={!usdtDepositAmount ? colors.offWhite : colors.textGray}
                                                                fontSize={'13px'}
                                                                letterSpacing={'-1px'}
                                                                fontWeight={'normal'}
                                                                fontFamily={'Aux'}>
                                                                You Deposit
                                                            </Text>
                                                            <Input
                                                                value={usdtDepositAmount}
                                                                onChange={(e) => {
                                                                    handleTokenDepositChange(e);
                                                                }}
                                                                fontFamily={'Aux'}
                                                                border='none'
                                                                mt='2px'
                                                                mr='-100px'
                                                                ml='-5px'
                                                                p='0px'
                                                                letterSpacing={'-6px'}
                                                                color={colors.offWhite}
                                                                _active={{ border: 'none', boxShadow: 'none' }}
                                                                _focus={{ border: 'none', boxShadow: 'none' }}
                                                                _selected={{ border: 'none', boxShadow: 'none' }}
                                                                fontSize='40px'
                                                                placeholder='0.0'
                                                                _placeholder={{
                                                                    color: selectedInputAsset.light_text_color,
                                                                }}
                                                            />
                                                            <Text
                                                                color={!usdtDepositAmount ? colors.offWhite : colors.textGray}
                                                                fontSize={'13px'}
                                                                mt='2px'
                                                                ml='1px'
                                                                letterSpacing={'-1px'}
                                                                fontWeight={'normal'}
                                                                fontFamily={'Aux'}>
                                                                {usdtDepositAmountUSD}
                                                            </Text>
                                                        </Flex>
                                                        <Spacer />
                                                        <Flex mt='1px' mr='6px'>
                                                            <AssetTag assetName={selectedInputAsset.name} />
                                                        </Flex>
                                                    </Flex>
                                                    {/* Profit Percentage Input */}
                                                    <Flex mt='10px' px='10px' bg='#161A33' w='100%' h='105px' border='2px solid #303F9F' borderRadius={'10px'}>
                                                        <Flex direction={'column'} py='10px' px='5px'>
                                                            <Text
                                                                color={!profitPercentage ? colors.offWhite : colors.textGray}
                                                                fontSize={'13px'}
                                                                letterSpacing={'-1px'}
                                                                fontWeight={'normal'}
                                                                fontFamily={'Aux'}>
                                                                Your Profit %
                                                            </Text>
                                                            <Input
                                                                value={profitPercentage}
                                                                onChange={(e) => {
                                                                    handleProfitPercentageChange(e);
                                                                }}
                                                                onBlur={handleProfitPercentageBlur}
                                                                onFocus={() => handleProfitPercentageFocus(profitPercentage)}
                                                                fontFamily={'Aux'}
                                                                border='none'
                                                                mt='2px'
                                                                mr='-120px'
                                                                ml='-5px'
                                                                p='0px'
                                                                letterSpacing={'-6px'}
                                                                color={colors.offWhite}
                                                                _active={{ border: 'none', boxShadow: 'none' }}
                                                                _focus={{ border: 'none', boxShadow: 'none' }}
                                                                _selected={{ border: 'none', boxShadow: 'none' }}
                                                                fontSize='40px'
                                                                placeholder='0.0'
                                                                _placeholder={{ color: '#5C63A3' }}
                                                            />
                                                            <Text
                                                                color={!profitPercentage ? colors.offWhite : colors.textGray}
                                                                fontSize={'13px'}
                                                                mt='2px'
                                                                ml='1px'
                                                                letterSpacing={'-1px'}
                                                                fontWeight={'normal'}
                                                                fontFamily={'Aux'}>
                                                                ≈ {profitAmountUSD}
                                                            </Text>
                                                        </Flex>
                                                        <Spacer />
                                                        <Flex
                                                            alignSelf={'center'}
                                                            mr='6px'
                                                            w='220px'
                                                            h='60px'
                                                            bg='#222753'
                                                            fontSize={'12px'}
                                                            align='center'
                                                            letterSpacing={'-1px'}
                                                            justify='center'
                                                            border='2px solid #3C4ABB'
                                                            borderRadius={'10px'}
                                                            textAlign='center'
                                                            direction='column'>
                                                            <Text color={colors.offWhite}>Your Exchange Rate</Text>
                                                            <Text>
                                                                1 BTC = {/* amount of deposit asset / amount of BTC out ) * deposit asset price in USD */}
                                                                {usdtDepositAmount && btcOutputAmount
                                                                    ? ((parseFloat(usdtDepositAmount) / parseFloat(btcOutputAmount)) * usdtPriceUSD).toLocaleString('en-US', {
                                                                          style: 'currency',
                                                                          currency: 'USD',
                                                                      })
                                                                    : '$0.00'}{' '}
                                                                {selectedInputAsset.name}
                                                            </Text>
                                                        </Flex>
                                                    </Flex>
                                                    {/* Bitcoin Amount Out */}
                                                    <Flex mt='10px' px='10px' bg='#2E1C0C' w='100%' h='105px' border='2px solid #78491F' borderRadius={'10px'}>
                                                        <Flex direction={'column'} py='10px' px='5px'>
                                                            <Text
                                                                color={!btcOutputAmount ? colors.offWhite : colors.textGray}
                                                                fontSize={'13px'}
                                                                letterSpacing={'-1px'}
                                                                fontWeight={'normal'}
                                                                fontFamily={'Aux'}>
                                                                You Recieve
                                                            </Text>
                                                            <Input
                                                                value={btcOutputAmount}
                                                                onChange={handleBitcoinOutputAmountChange}
                                                                fontFamily={'Aux'}
                                                                border='none'
                                                                mt='2px'
                                                                mr='-5px'
                                                                ml='-5px'
                                                                p='0px'
                                                                letterSpacing={'-6px'}
                                                                color={colors.offWhite}
                                                                _active={{ border: 'none', boxShadow: 'none' }}
                                                                _focus={{ border: 'none', boxShadow: 'none' }}
                                                                _selected={{ border: 'none', boxShadow: 'none' }}
                                                                fontSize='40px'
                                                                placeholder='0.0'
                                                                _placeholder={{ color: '#805530' }}
                                                            />
                                                            <Text
                                                                color={!btcOutputAmount ? colors.offWhite : colors.textGray}
                                                                fontSize={'13px'}
                                                                mt='2px'
                                                                ml='1px'
                                                                letterSpacing={'-1.5px'}
                                                                fontWeight={'normal'}
                                                                fontFamily={'Aux'}>
                                                                ≈ {bitcoinOutputAmountUSD}
                                                            </Text>
                                                        </Flex>
                                                        <Spacer />
                                                        <Flex mt='1px' mr='6px'>
                                                            <AssetTag assetName='BTC' />
                                                        </Flex>
                                                    </Flex>
                                                </Flex>
                                            </Flex>
                                        </Flex>
                                    </Flex>
                                </ModalBody>
                                <ModalFooter>
                                    <Button
                                        bg={colors.purpleButtonBG}
                                        color={colors.offWhite}
                                        mb='10px'
                                        _hover={{ bg: colors.purpleHover }}
                                        mt='-5px'
                                        w='350px'
                                        border={'2px solid #445BCB'}
                                        mr={3}
                                        onClick={onClose}>
                                        UPDATE EXCHANGE RATE
                                    </Button>
                                </ModalFooter>
                            </ModalContent>
                        </Modal>

                        {/* Deposit Button */}
                        <Flex
                            alignSelf={'center'}
                            bg={
                                isConnected
                                    ? usdtDepositAmount && btcOutputAmount && payoutBTCAddress
                                        ? colors.purpleBackground
                                        : colors.purpleBackgroundDisabled
                                    : colors.purpleBackground
                            }
                            _hover={{ bg: colors.purpleHover }}
                            w='290px'
                            mt='10px'
                            transition={'0.2s'}
                            h='45px'
                            onClick={async () => {
                                console.log('usdtDepositAmount:', usdtDepositAmount);
                                console.log('btcOutputAmount:', btcOutputAmount);
                                console.log('payoutBTCAddress:', payoutBTCAddress);
                                if (usdtDepositAmount && btcOutputAmount && payoutBTCAddress) {
                                    initiateDeposit();
                                }
                            }}
                            fontSize={'15px'}
                            align={'center'}
                            userSelect={'none'}
                            cursor={'pointer'}
                            borderRadius={'10px'}
                            justify={'center'}
                            border={
                                isConnected
                                    ? usdtDepositAmount && btcOutputAmount && payoutBTCAddress && validateBitcoinPayoutAddress(payoutBTCAddress)
                                        ? '3px solid #445BCB'
                                        : '3px solid #3242a8'
                                    : '3px solid #445BCB'
                            }>
                            <Text
                                color={
                                    isConnected
                                        ? usdtDepositAmount && btcOutputAmount && payoutBTCAddress && validateBitcoinPayoutAddress(payoutBTCAddress)
                                            ? colors.offWhite
                                            : colors.darkerGray
                                        : colors.offWhite
                                }
                                fontFamily='Nostromo'>
                                {isConnected ? 'Deposit Liquidity' : 'Connect Wallet'}
                            </Text>
                        </Flex>
                    </Flex>
                </Flex>
            </Flex>
            <DepositStatusModal isOpen={isModalOpen} onClose={handleModalClose} status={depositLiquidityStatus} error={depositLiquidityError} txHash={txHash} />
        </Flex>
    );
};
