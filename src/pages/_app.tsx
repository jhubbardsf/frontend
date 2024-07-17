import { ChakraProvider, Flex, Text } from '@chakra-ui/react';
import theme from '../theme';
import Head from 'next/head';
import { useEffect } from 'react';
import { useStore } from '../store';
import { AppProps } from 'next/app';
import '../styles/custom-fonts.css';
import testData from '../testData.json';
import assets from '../assets.json';
import { MdClose } from 'react-icons/md';
import { colors } from '../utils/colors';
import toast, { ToastBar, Toaster } from 'react-hot-toast';
import '@rainbow-me/rainbowkit/styles.css';
import { WagmiProvider } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { getDefaultConfig, RainbowKitProvider, darkTheme, Theme } from '@rainbow-me/rainbowkit';

const config = getDefaultConfig({
    appName: 'My RainbowKit App',
    projectId: 'YOUR_PROJECT_ID',
    chains: [mainnet],
    ssr: true, // If your dApp uses server side rendering (SSR)
});

const myCustomTheme = {
    blurs: {
        modalOverlay: '...',
    },
    colors: {
        accentColor: '...',
        accentColorForeground: '...',
        actionButtonBorder: 'rgba(255, 255, 255, 0.04)',
        actionButtonBorderMobile: 'rgba(255, 255, 255, 0.08)',
        actionButtonSecondaryBackground: 'rgba(255, 255, 255, 0.08)',
        closeButton: 'rgba(224, 232, 255, 0.6)',
        closeButtonBackground: 'rgba(255, 255, 255, 0.08)',
        connectButtonBackground: '...',
        connectButtonBackgroundError: '#FF494A',
        connectButtonInnerBackground: 'linear-gradient(0deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.15))',
        connectButtonText: '#FFF',
        connectButtonTextError: '#FFF',
        connectionIndicator: '#30E000',
        downloadBottomCardBackground: 'linear-gradient(126deg, rgba(0, 0, 0, 0) 9.49%, rgba(120, 120, 120, 0.2) 71.04%), #1A1B1F',
        downloadTopCardBackground: 'linear-gradient(126deg, rgba(120, 120, 120, 0.2) 9.49%, rgba(0, 0, 0, 0) 71.04%), #1A1B1F',
        error: '#FF494A',
        generalBorder: 'rgba(255, 255, 255, 0.08)',
        generalBorderDim: 'rgba(255, 255, 255, 0.04)',
        menuItemBackground: 'rgba(224, 232, 255, 0.1)',
        modalBackdrop: 'rgba(0, 0, 0, 0.3)',
        modalBackground: colors.offBlack,
        modalBorder: 'rgba(255, 255, 255, 0.08)',
        modalText: '#FFF',
        modalTextDim: 'rgba(224, 232, 255, 0.3)',
        modalTextSecondary: 'rgba(255, 255, 255, 0.6)',
        profileAction: 'rgba(224, 232, 255, 0.1)',
        profileActionHover: 'rgba(224, 232, 255, 0.2)',
        profileForeground: colors.offBlack,
        selectedOptionBorder: 'rgba(224, 232, 255, 0.1)',
        standby: '#FFD641',
    },
    fonts: {
        body: '...',
    },
    radii: {
        actionButton: '5px',
        connectButton: '5px',
        menuButton: '10px',
        modal: '20px',
        modalMobile: '5px',
    },
    shadows: {
        connectButton: '0px 4px 12px rgba(0, 0, 0, 0.1)',
        dialog: '0px 8px 32px rgba(0, 0, 0, 0.32)',
        profileDetailsAction: '0px 2px 6px rgba(37, 41, 46, 0.04)',
        selectedOption: '0px 2px 6px rgba(0, 0, 0, 0.24)',
        selectedWallet: '0px 2px 6px rgba(0, 0, 0, 0.24)',
        walletLogo: '0px 2px 16px rgba(0, 0, 0, 0.16)',
    },
};

function MyApp({ Component, pageProps }: AppProps) {
    const setActivityData = useStore((state) => state.setActivityData);
    const setLiquidityData = useStore((state) => state.setLiquidityData);
    const setAvailableAssets = useStore((state) => state.setAvailableAssets);
    const queryClient = new QueryClient();

    useEffect(() => {
        // TODO: populate all real data from smart contracts
        setActivityData(testData.activity);
        setLiquidityData(testData.liquidity);
        setAvailableAssets(assets.avalible_assets);
    }, [setActivityData, setLiquidityData, setAvailableAssets]);

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider theme={myCustomTheme}>
                    <ChakraProvider theme={theme}>
                        {/* <title>Rift Hyperbridge - </title> */}
                        <Component {...pageProps} />
                        <Toaster
                            toastOptions={{
                                position: 'bottom-center',
                                style: {
                                    borderRadius: '5px',
                                    background: '#333',
                                    color: '#fff',
                                    minWidth: '300px',
                                    maxWidth: '500px',
                                    transition: '0.2s all ease-in-out',
                                    minHeight: '50px',
                                    zIndex: 2,
                                },
                                success: {
                                    style: {
                                        // backgroundColor: '#2ECC40',
                                        background:
                                            'linear-gradient(155deg, rgba(23,139,11,1) 0%, rgba(33,150,34,1) 42%, rgba(46,204,64,1) 100%)',
                                    },
                                    iconTheme: {
                                        primary: '#2ECC40',
                                        secondary: colors.offWhite,
                                    },
                                    duration: 2000,
                                },
                                loading: {
                                    style: {
                                        background:
                                            'linear-gradient(155deg, rgba(20,41,77,1) 0%, rgba(45,102,196,1) 42%, rgba(48,123,244,1) 100%)',
                                    },
                                },
                                error: {
                                    style: {
                                        background:
                                            'linear-gradient(155deg, rgba(140,29,30,1) 0%, rgba(163,23,24,1) 42%, rgba(219,0,2,1) 100%)',
                                    },
                                    duration: 4000,
                                },
                            }}>
                            {(t) => (
                                <ToastBar toast={t}>
                                    {({ icon, message }) => {
                                        const messages = (message as any).props.children.split(';;');
                                        const title = messages[0];
                                        const description = messages.length > 1 ? messages[1] : null;
                                        return (
                                            <>
                                                <Flex
                                                    fontFamily={'Aux'}
                                                    h='100%'
                                                    // pt='5px'
                                                >
                                                    {icon}
                                                </Flex>
                                                <Flex
                                                    // bg='black'
                                                    flex={1}
                                                    pl='10px'
                                                    pr='10px'
                                                    flexDir='column'>
                                                    <Text fontFamily={'Aux'} fontWeight='600'>
                                                        {title}
                                                    </Text>
                                                    {description && description != 'undefined' && (
                                                        <Text fontFamily={'Aux'}>{description}</Text>
                                                    )}
                                                </Flex>
                                                {t.type !== 'loading' && (
                                                    <Flex
                                                        p='3px'
                                                        cursor='pointer'
                                                        onClick={() => toast.dismiss(t.id)}
                                                        color={colors.offWhite}
                                                        transition='0.2s color ease-in-out'
                                                        _hover={{
                                                            color: colors.textGray,
                                                        }}>
                                                        <MdClose />
                                                    </Flex>
                                                )}
                                            </>
                                        );
                                    }}
                                </ToastBar>
                            )}
                        </Toaster>
                    </ChakraProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}

export default MyApp;
