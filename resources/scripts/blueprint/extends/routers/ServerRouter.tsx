import React, { useState, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import PermissionRoute from '@/components/elements/PermissionRoute';
import Can from '@/components/elements/Can';
import Spinner from '@/components/elements/Spinner';
import { NotFound } from '@/components/elements/ScreenBlock';
import { useStoreState } from 'easy-peasy';
import { ServerContext } from '@/state/server';

import routes from '@/routers/routes';
import blueprintRoutes from './routes';
import { UiBadge } from '@blueprint/ui';

const blueprintExtensions = [...new Set(blueprintRoutes.server.map((route) => route.identifier))];

/** Get the route egg IDs for each extension with server routes. */
const useExtensionEggs = () => {
    const [extensionEggs, setExtensionEggs] = useState<{ [x: string]: string[] }>(
        blueprintExtensions.reduce((prev, current) => ({ ...prev, [current]: ['-1'] }), {})
    );

    useEffect(() => {
        (async () => {
            const newEggs: { [x: string]: string[] } = {};
            for (const id of blueprintExtensions) {
                const resp = await fetch(`/api/client/extensions/blueprint/eggs?${new URLSearchParams({ id })}`);
                newEggs[id] = (await resp.json()) as string[];
            }
            setExtensionEggs(newEggs);
        })();
    }, []);

    return extensionEggs;
};

export const NavigationLinks = () => {
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const serverEgg = ServerContext.useStoreState((state) => state.server.data?.BlueprintFramework.eggId);
    const { id } = useParams<{ id: string }>();
    // Build absolute URLs like the old match.url variant
    const baseUrl = `/server/${id ?? ''}`;
    const to = (value: string) =>
        value === '/'
            ? baseUrl.replace(/\/$/, '')
            : `${baseUrl.replace(/\/*$/, '')}/${value.replace(/^\/+/, '')}`;

    const extensionEggs = useExtensionEggs();

    return (
        <>
            {/* Pterodactyl routes */}
            {routes.server
                .filter((route) => !!route.name)
                .map((route) =>
                    route.permission ? (
                        <Can key={route.path} action={route.permission} matchAny>
                            <NavLink to={to(route.path ?? '')} end={!!route.exact}>
                                {route.name}
                            </NavLink>
                        </Can>
                    ) : (
                        <NavLink key={route.path} to={to(route.path ?? '')} end={!!route.exact}>
                            {route.name}
                        </NavLink>
                    )
                )}

            {/* Blueprint routes */}
            {blueprintRoutes.server.length > 0 &&
                blueprintRoutes.server
                    .filter((route) => !!route.name)
                    .filter((route) => (route.adminOnly ? rootAdmin : true))
                    .filter((route) =>
                        extensionEggs[route.identifier].includes('-1')
                            ? true
                            : extensionEggs[route.identifier].find((eggId) => eggId === serverEgg?.toString())
                    )
                    .map((route) =>
                        route.permission ? (
                            <Can key={route.path} action={route.permission} matchAny>
                                <NavLink to={to(route.path ?? '')} end={!!route.exact}>
                                    {route.name}
                                    {route.adminOnly ? (
                                        <>
                                            <span className="hidden">(</span>
                                            <UiBadge>ADMIN</UiBadge>
                                            <span className="hidden">)</span>
                                        </>
                                    ) : undefined}
                                </NavLink>
                            </Can>
                        ) : (
                            <NavLink key={route.path} to={to(route.path ?? '')} end={!!route.exact}>
                                {route.name}
                                {route.adminOnly ? (
                                    <>
                                        <span className="hidden">(</span>
                                        <UiBadge>ADMIN</UiBadge>
                                        <span className="hidden">)</span>
                                    </>
                                ) : undefined}
                            </NavLink>
                        )
                    )}
        </>
    );
};

export const NavigationRouter = () => {
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const serverEgg = ServerContext.useStoreState((state) => state.server.data?.BlueprintFramework.eggId);
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const extensionEggs = useExtensionEggs();

    // Build absolute paths like the old match.path variant
    const basePath = `/server/${id ?? ''}`;
    const toPath = (value: string) =>
        value === '/'
            ? basePath.replace(/\/$/, '')
            : `${basePath.replace(/\/*$/, '')}/${value.replace(/^\/+/, '')}`;

    return (
        <Routes location={location}>
            {/* Pterodactyl routes */}
            {routes.server.map(({ path, permission, component: Component }) => (
                <Route
                    key={path}
                    path={toPath(path ?? '')}
                    element={
                        <PermissionRoute permission={permission}>
                            <Spinner.Suspense>
                                <Component />
                            </Spinner.Suspense>
                        </PermissionRoute>
                    }
                />
            ))}

            {/* Blueprint routes */}
            {blueprintRoutes.server.length > 0 &&
                blueprintRoutes.server
                    .filter((route) => (route.adminOnly ? rootAdmin : true))
                    .filter((route) =>
                        extensionEggs[route.identifier].includes('-1')
                            ? true
                            : extensionEggs[route.identifier].find((eggId) => eggId === serverEgg?.toString())
                    )
                    .map(({ path, permission, component: Component }) => (
                        <Route
                            key={path}
                            path={toPath(path ?? '')}
                            element={
                                <PermissionRoute permission={permission}>
                                    <Spinner.Suspense>
                                        <Component />
                                    </Spinner.Suspense>
                                </PermissionRoute>
                            }
                        />
                    ))}

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
};
