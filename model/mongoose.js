import mongoose from 'mongoose';
import mongooseLeanVirtuals from 'mongoose-lean-virtuals';

const STREAMIENT_MONGOOSE_DEFAULTS = Symbol.for('streamient.mongoose.defaults');
const STREAMIENT_SCHEMA_DEFAULTS = Symbol.for('streamient.mongoose.schema.defaults');

function mergeLeanVirtuals(leanOptions) {
	if (leanOptions === false) return false;
	if (leanOptions === undefined || leanOptions === true) return { virtuals: true };
	if (typeof leanOptions === 'object') return { ...leanOptions, virtuals: true };
	return leanOptions;
}

export function hydratedQuery(query) {
	return typeof query?.lean === 'function' ? query.lean(false) : query;
}

function applySchemaDefaults(schema) {
	if (schema[STREAMIENT_SCHEMA_DEFAULTS]) return;
	schema[STREAMIENT_SCHEMA_DEFAULTS] = true;

	schema.set('usePushEach', true);
	schema.set('read', 'secondaryPreferred');

	const toJSON = schema.get('toJSON') || {};
	schema.set('toJSON', { ...toJSON, virtuals: true });

	schema.plugin(mongooseLeanVirtuals);
	schema.pre(/^find/, function applyLeanVirtuals() {
		this._mongooseOptions.lean = mergeLeanVirtuals(this._mongooseOptions.lean);
	});
}

if (!mongoose[STREAMIENT_MONGOOSE_DEFAULTS]) {
	mongoose[STREAMIENT_MONGOOSE_DEFAULTS] = true;
	mongoose.plugin(applySchemaDefaults);
}

export default mongoose;
