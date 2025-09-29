// TODO: Add Attribution Component if needed.
import { Form } from 'formik';
import { forwardRef } from 'react';

import FlashMessageRender from '@/components/FlashMessageRender';

// import Attribution from '@/blueprint/extends/Attribution';
import BeforeContent from '@/blueprint/components/Authentication/Container/BeforeContent';
import AfterContent from '@/blueprint/components/Authentication/Container/AfterContent';

type Props = React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> & {
    title?: string;
};

const LoginFormContainer = forwardRef<HTMLFormElement, Props>(({ title, ...props }, ref) => (
    <div className='w-full max-w-lg px-8'>
        {title && <h2 className={`text-3xl text-center text-zinc-100 font-medium py-4`}>{title}</h2>}
        <FlashMessageRender />
        <BeforeContent />
        <Form {...props} ref={ref}>
            <div className={`flex w-full`}>
                <div className={`flex-1`}>{props.children}</div>
            </div>
        </Form>
        <AfterContent />
    </div>
));

LoginFormContainer.displayName = 'LoginFormContainer';

export default LoginFormContainer;
