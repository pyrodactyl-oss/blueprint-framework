import React, { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import PermissionRoute from '@/components/elements/PermissionRoute';
import Can from '@/components/elements/Can';
import Spinner from '@/components/elements/Spinner';
import { NotFound } from '@/components/elements/ScreenBlock';
import { useStoreState } from 'easy-peasy';
import { ServerContext } from '@/state/server';

import routes from '@/routers/routes';
import blueprintRoutes from './routes';
import { UiBadge } from '@blueprint/ui';

/**
 * NOTE: This file assumes its parent route is mounted with a splat:
 *   <Route path="/server/:id/*" element={<YourLayoutWithOutlet />} />
 * That is required for nested children to match deeper segments in v6+.  :contentReference[oaicite:1]{index=1}
 */

const blueprintExtensions = [...new Set(blueprintRoutes.server.map((route) => route.identifier))];

/** Get the route egg IDs for each extension with server routes. */
const useExtensionEggs = () => {
    const [extensionEggs, setExtensionEggs] = useState<{ [x: string]: string[] }>(
        blueprintExtensions.reduce((prev, current) => ({ ...prev, [current]: ['-1'] }), {})
    );

    useEffect(() => {
        (async () => {
            try {
                const newEggs: { [x: string]: string[] } = {};
                for (const id of blueprintExtensions) {
                    const resp = await fetch(
                        `/api/client/extensions/blueprint/eggs?${new URLSearchParams({ id })}`
                    );
                    const json = (await resp.json()) as string[] | null;
                    newEggs[id] = Array.isArray(json) && json.length ? json : ['-1'];
                }
                setExtensionEggs(newEggs);
            } catch {
                // On any error, fall back to "-1" (available everywhere)
                setExtensionEggs(
                    blueprintExtensions.reduce((prev, current) => ({ ...prev, [current]: ['-1'] }), {})
                );
            }
        })();
    }, []);

    return extensionEggs;
};

/** Normalize a route segment for relative routing. '/' -> '' (index), strip leading/trailing slashes */
const seg = (value?: string) => (value ? value.replace(/^\/+|\/+$/g, '') : '');

/** Build a relative path for <Route>. Adds '/*' when exact === false (RRv6 uses splat for nested). */
const relPath = (value?: string, exact?: boolean) => {
    const s = seg(value); // '' means "index route"
    const isExact = exact ?? true;
    return isExact ? s : `${s}/*`;
};

/** Build a relative target for <NavLink>. '' hits the parent's index. */
const toRel = (value?: string) => {
    if (!value || value === '/') return '';
    return value.replace(/^\/+/, '');
};

export const NavigationLinks = () => {
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const serverEgg = ServerContext.useStoreState(
        (state) => state.server.data?.BlueprintFramework.eggId
    );
    const extensionEggs = useExtensionEggs();

    return (
        <>
            {/* Pterodactyl routes */}
            {routes.server
                .filter((route) => !!route.name)
                .map((route) =>
                    route.permission ? (
                        <Can key={route.path ?? 'core-unnamed'} action={route.permission} matchAny>
                            <NavLink to={toRel(route.path)} end={route.exact ?? true}>
                                {route.name}
                            </NavLink>
                        </Can>
                    ) : (
                        <NavLink key={route.path ?? 'core-unnamed'} to={toRel(route.path)} end={route.exact ?? true}>
                            {route.name}
                        </NavLink>
                    )
                )}

            {/* Blueprint routes */}
            {blueprintRoutes.server.length > 0 &&
                blueprintRoutes.server
                    .filter((route) => !!route.name)
                    .filter((route) => (route.adminOnly ? rootAdmin : true))
                    .filter((route) => {
                        const eggs = extensionEggs[route.identifier] ?? ['-1'];
                        const needle = serverEgg?.toString() ?? '';
                        return eggs.includes('-1') || (needle && eggs.includes(needle));
                    })
                    .map((route) =>
                        route.permission ? (
                            <Can key={route.path ?? 'bp-unnamed'} action={route.permission} matchAny>
                                <NavLink to={toRel(route.path)} end={route.exact ?? true}>
                                    {route.name}
                                    {route.adminOnly ? (
                                        <>
                                            <span className="hidden">(</span>
                                            <UiBadge>ADMIN</UiBadge>
                                            <span className="hidden">)</span>
                                        </>
                                    ) : null}
                                </NavLink>
                            </Can>
                        ) : (
                            <NavLink key={route.path ?? 'bp-unnamed'} to={toRel(route.path)} end={route.exact ?? true}>
                                {route.name}
                                {route.adminOnly ? (
                                    <>
                                        <span className="hidden">(</span>
                                        <UiBadge>ADMIN</UiBadge>
                                        <span className="hidden">)</span>
                                    </>
                                ) : null}
                            </NavLink>
                        )
                    )}
        </>
    );
};

export const NavigationRouter = () => {
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const serverEgg = ServerContext.useStoreState(
        (state) => state.server.data?.BlueprintFramework.eggId
    );
    const location = useLocation();
    const extensionEggs = useExtensionEggs();

    // Pre-filter blueprint routes once
    const bpRoutes = blueprintRoutes.server
        .filter((route) => (route.adminOnly ? rootAdmin : true))
        .filter((route) => {
            const eggs = extensionEggs[route.identifier] ?? ['-1'];
            const needle = serverEgg?.toString() ?? '';
            return eggs.includes('-1') || (needle && eggs.includes(needle));
        });

    return (
        <Routes location={location}>
            {/* Pterodactyl routes */}
            {routes.server.map(({ path, permission, component: Component, exact }) => {
                const s = seg(path ?? '');
                const isIndex = (exact ?? true) && s === '';
                if (isIndex) {
                    return (
                        <Route
                            key="core-index"
                            index
                            element={
                                <PermissionRoute permission={permission}>
                                    <Spinner.Suspense>
                                        <Component />
                                    </Spinner.Suspense>
                                </PermissionRoute>
                            }
                        />
                    );
                }
                return (
                    <Route
                        key={path ?? 'core-route'}
                        path={relPath(path ?? '', exact)}
                        element={
                            <PermissionRoute permission={permission}>
                                <Spinner.Suspense>
                                    <Component />
                                </Spinner.Suspense>
                            </PermissionRoute>
                        }
                    />
                );
            })}

            {/* Blueprint routes */}
            {bpRoutes.map(({ path, permission, component: Component, exact }) => {
                const s = seg(path ?? '');
                const isIndex = (exact ?? true) && s === '';
                if (isIndex) {
                    return (
                        <Route
                            key="bp-index"
                            index
                            element={
                                <PermissionRoute permission={permission ?? undefined}>
                                    <Spinner.Suspense>
                                        <Component />
                                    </Spinner.Suspense>
                                </PermissionRoute>
                            }
                        />
                    );
                }
                return (
                    <Route
                        key={path ?? 'bp-route'}
                        path={relPath(path ?? '', exact)}
                        element={
                            <PermissionRoute permission={permission ?? undefined}>
                                <Spinner.Suspense>
                                    <Component />
                                </Spinner.Suspense>
                            </PermissionRoute>
                        }
                    />
                );
            })}

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
};
