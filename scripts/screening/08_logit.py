"""Step 8 (cross-check only): a logistic model that picks its own weights from 35 variables, cores vs background,
5-fold cross-validated AUC without shuffling. Not used to score."""
import json, os, pathlib, numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import roc_auc_score
WORK = pathlib.Path(os.environ.get('SCREEN_WORK', '/tmp/citymeter-screening'))
Z = dict(np.load(WORK / 'seeds.npz')); dist = Z['dist']; SC_ = np.load(WORK / 'score.npz'); best, pctN = SC_['best'], SC_['pctN']
LAY = ['sc_centre', 'sc_venue', 'lodging', 'office', 'grocery', 'pharmacy', 'luxurybrands', 'camera', 'fitness', 'transit', 'university', 'hospital',
       'governmentoffice', 'school', 'factory', 'industrialestate']
names = [f'{k}@{r}' for r in (400, 800) for k in LAY] + ['layers9@400', 'positions9@400', 'provincePct']
X = np.c_[np.column_stack([np.log1p(Z[f'{k}@{r}']) for r in (400, 800) for k in LAY]), Z['layN'], np.log1p(Z['posN']), pctN]
pos = best[best >= 0]; neg = np.where(dist > 1000)[0]; ix = np.r_[pos, neg]; y = np.r_[np.ones(len(pos)), np.zeros(len(neg))]
model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=5000, class_weight='balanced'))
p = cross_val_predict(model, X[ix], y, cv=StratifiedKFold(5), method='predict_proba')[:, 1]
model.fit(X[ix], y); coef = model[-1].coef_[0]
out = {'cvAuc': round(float(roc_auc_score(y, p)), 3), 'features': len(names), 'coef': {names[i]: round(float(coef[i]), 3) for i in np.argsort(-np.abs(coef))}}
json.dump(out, open(WORK / 'logit.json', 'w'), indent=1)
print('cross-validated AUC', out['cvAuc'])
