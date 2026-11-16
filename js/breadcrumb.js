/**
 * Breadcrumb — ประเทศไทย › จังหวัด › ย่าน — the CityMETER production hierarchy through the shared shell
 * (js/shell/breadcrumb.js, citymeter-shell). A neighbourhood of the central registry is an area this dataset defines
 * itself (an analytical ย่าน, not a production area): its crumb is a `zone`, after the province, with no production link
 * (demo-platform-review §5.3; shell 0.4.2).
 */
import {provinceByCode} from './model.js';
import {buildBreadcrumb as shellBreadcrumb, renderBreadcrumb, breadcrumbText, deepestHref} from './shell/breadcrumb.js';

/**
 * Production dataset code (`?d=`): '' while the dataset registry names no production code for the neighbourhood
 * registry — the address and the production links then name the place alone (citymeter-shell 0.4.3).
 */
export const DATASET = '';

const areaWord = province => (province === 'BKK' ? 'เขต' : 'อำเภอ');

/** Pure model. province = production code or ''; zone = {id, name, province} (a neighbourhood) or null. */
export const buildBreadcrumb = (sel = {}) => shellBreadcrumb(sel, {dataset: DATASET, provinceByCode, areaWord});
export {renderBreadcrumb, breadcrumbText};

/** Production deep link of the deepest administrative crumb. */
export const productionHref = crumbs => deepestHref(crumbs, DATASET);
