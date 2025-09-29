import { useEffect } from 'react';

import FlashMessageRender from '@/components/FlashMessageRender';
import MainPage from '@/components/elements/MainPage';

export interface PageContentBlockProps {
    title?: string;
    className?: string;
    showFlashKey?: string;
    children?: React.ReactNode;
}

// import Attribution from '@/blueprint/extends/Attribution';
import BeforeSection from '@/blueprint/components/Dashboard/Global/BeforeSection';
import AfterSection from '@/blueprint/components/Dashboard/Global/AfterSection';

const PageContentBlock: React.FC<PageContentBlockProps> = ({ title, showFlashKey, className, children }) => {
    useEffect(() => {
        if (title) {
            document.title = title + ' | Pyrodactyl';
        }
    }, [title]);

    return (
        <>
            <BeforeSection />

            <MainPage className={`${className || ''} max-w-[120rem] w-full mx-auto px-2 sm:px-14 py-2 sm:py-14`}>
                {showFlashKey && <FlashMessageRender byKey={showFlashKey} />}
                {children}
            </MainPage>
            
            <AfterSection />
        </>
    );
};

export default PageContentBlock;
