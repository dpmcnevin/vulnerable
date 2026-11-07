// Hand-drawn 16x16 pixel icons for every relic and ploy. Port of src/ui/icons.lua.
// Each is a single distinct object with an outline and a top-left light source.
// Icons sit on a small cream tile so dark outlines read on dark panels.
// The sprite data is converted verbatim from the Lua tables.

import { hex, type Color } from './theme.ts';
import { newBitmap, type Bitmap } from './pixel.ts';

export const PALETTE: Record<string, Color> = {
	k: hex('#1b1d26'),
	w: hex('#f3ead6'),
	W: hex('#ffffff'),
	g: hex('#b8902f'),
	G: hex('#e8c873'),
	h: hex('#7a5a1a'),
	y: hex('#f2d14b'),
	Y: hex('#fff2a0'),
	r: hex('#c8323c'),
	R: hex('#7c1f27'),
	l: hex('#f08a8a'),
	o: hex('#d9771f'),
	O: hex('#f5b46a'),
	n: hex('#23804e'),
	N: hex('#4fbf7a'),
	v: hex('#145232'),
	b: hex('#3a7bd5'),
	B: hex('#8cc3f0'),
	u: hex('#1f3f7a'),
	p: hex('#7a4fc1'),
	P: hex('#b49be8'),
	q: hex('#45287a'),
	s: hex('#7d828c'),
	S: hex('#c7cbd3'),
	t: hex('#4a4e57'),
	d: hex('#7a5230'),
	D: hex('#c08a55'),
	e: hex('#4a2e18'),
	m: hex('#5e1a26'),
	M: hex('#8a2a3a'),
	c: hex('#3fb6c9'),
	C: hex('#a6e6ef'),
};

export const SIZE = 16;
export const TILE = 18;

export const ICONS: Record<string, string[]> = {
	honour_roll: [
		'................', '..kkkkkkkkkkkk..', '.kDwwwwwwwwwwDk.', '.kDkkkkkkkkkkDk.',
		'..kwwwwwwwwwwk..', '..kwsssssssswk..', '..kwwwwwwwwwwk..', '..kwssssssswwk..',
		'..kwwwwwwwwwwk..', '..kwsssskkkwwk..', '..kwwwwkrrrkwk..', '..kwwwkrlrrRkk..',
		'.kDkkkkrrrRRk...', '.kDwwwkkRRRk....', '..kkkk.krkrk....', '.......kk.kk....',
	],
	ace_collector: [
		'..kkkkkkkkkkkk..', '..kWWWWWWWWWWkt.', '..kWrWWWWWWWWkt.', '..kWWWWrrWWWWkt.',
		'..kWWWrRRrWWWkt.', '..kWWWrRRrWWWkt.', '..kWWrRWWRrWWkt.', '..kWWrRWWRrWWkt.',
		'..kWWrrrrrrWWkt.', '..kWrRWWWWRrWkt.', '..kWrRWWWWRrWkt.', '..kWWWWWWWWWWkt.',
		'..kWWWWWWWWrWkt.', '..kkkkkkkkkkkkt.', '...tttttttttttt.', '................',
	],
	milton_work: [
		'................', '.eeeeeeeeeeeeee.', '.eDDDDDDDDDDDDe.', '.eD..........De.',
		'.eDlRlRssssbuDe.', '.eD..........De.', '.eDssYgYgssssDe.', '.eD..........De.',
		'.eDNvNvNvsssbDe.', '.eD..........De.', '.eDssssBuBuBuDe.', '.eD..........De.',
		'.eDDDDDDDDDDDDe.', '.eeeeeeeeeeeeee.', '.ee..........ee.', '................',
	],
	the_ruffer: [
		'.............kk.', '............kWSk', '...........kWSk.', '..........kWSk..',
		'.........kWSk...', '........kWSk....', '.......kWSk.....', '..kk..kWSk......',
		'..kGkkWSk.......', '...kGgSk........', '....kgGk........', '...kekkGk.......',
		'..kek..kgk......', '.kek....kk......', '.kk.............', '................',
	],
	dummy_reversal: [
		'................', '....kkkkkkkk....', '..kkDDDDDDDdkk..', '.kDDDDDDDDDDddk.',
		'.kDDDDDDDDDDddk.', '..kDDDDDDDDddk..', '...kDDDDDDddk...', '...kYyYyYyYyk...',
		'..kDDDDDDDDddk..', '..kDDDDDDDDddk..', '...kkkkkkkkkk...', '.......ke.......',
		'.......ke.......', '.......ke.......', '.....kkeekk.....', '....keeeeeek....',
	],
	shape_shifter: [
		'................', '............kkk.', '............kNk.', '............kNk.',
		'........kkk.kNk.', '........kOk.kNk.', '........kOk.kvk.', '....kkk.kOk.kvk.',
		'....kBk.kok.kvk.', '....kBk.kok.kvk.', 'kkk.kbk.kok.kvk.', 'klk.kbk.kok.kvk.',
		'krk.kbk.kok.kvk.', 'kRk.kuk.kok.kvk.', 'kkkkkkkkkkkkkkkk', '................',
	],
	overtrick_artist: [
		'....kkkkkkk.....', '..kkDDDDDDDkk...', '.kDDDDDDDDDDDk..', 'kDDlrDDDDBbDDDk.',
		'kDDrRDDDDbuDDDk.', 'kDDDDDDDDDDDDk..', 'kDDYyDDkkkDDk...', 'kDDyyDk...kk..k.',
		'kDDDDDk......kWk', '.kDNnDDk....kWk.', '.kDnvDDDk..kSk..', '..kDDDDDDkkdk...',
		'...kkDDDDkek....', '.....kkkkkk.....', '................', '................',
	],
	safety_play: [
		'..kkkkkkkkkkkk..', '.kGGGGGGGGGGGGk.', '.kGBBBBBBbbbbGk.', '.kGBBBWWbbbbbGk.',
		'.kGBBWWWWbbbbGk.', '.kGBWWbWWWbbbGk.', '.kGBWbbbbWWbuGk.', '.kGBbbbbbbbbuGk.',
		'.kGbbbbbbbbuuGk.', '..kGbbbbbbuuGk..', '..kGbbbbbuuuGk..', '...kGbbbuuuGk...',
		'....kGbuuuGk....', '.....kGuuGk.....', '......kGGk......', '.......kk.......',
	],
	the_squeeze: [
		'.........kk.....', '........kNvk....', '.......kNNvk....', '.....kkkkvk.....',
		'...kkYYYYykk....', '..kYYYWYyyyyk...', '.kYYYWYyyyyyyk..', 'kYYYYYyyyyyyyok.',
		'kyYYYyyyyyyyyok.', 'kyyyyyyyyyyyyok.', '.kyyyyyyyyyyook.', '..kyyyyyyyyook..',
		'...kkyyyyyookk..', '.....kkkkkkk....', '................', '................',
	],
	endplay: [
		'.eeeeeeeeeeeeee.', '.eDDDDDDDDDDDDe.', '.eeeeeeeeeeeeee.', '..kSWSSSSSSSSk..',
		'..kSyYYyyyyySk..', '...kSyyyyyySk...', '....kSyyyySk....', '.....kSyySk.....',
		'.....kSySSk.....', '....kSSyySSk....', '...kSSSyySSSk...', '..kSSyyyyyySSk..',
		'..kSyyyyyyyySk..', '.eeeeeeeeeeeeee.', '.eDDDDDDDDDDDDe.', '.eeeeeeeeeeeeee.',
	],
	nine_card_fit: [
		'................', '......kkkk......', '.....kNNvvk.....', '.....kNvvvk.....',
		'..kkkkkvvkkkkk..', '..kNNNNvvvvvvk..', '..kNnnnnnnnnvkk.', '..kNnnnnnnnnvvvk',
		'..kNnnnnnnnnvvvk', '..kNnnnnnnnnvvk.', '..kNnnnnnnnnvk..', '..kNnnnnnnnnvk..',
		'..kvvvvkkvvvvk..', '..kkkkkk..kkkk..', '................', '................',
	],
	the_void: [
		'.....qqqqqq.....', '...qqPPPPPPqq...', '..qPPqqqqqqPPq..', '.qPqqkkkkkkqqPq.',
		'.qPqkkkkkkkkqPq.', 'qPqkkkkkkkkkkqPq', 'qPqkkkkkkkkkkqPq', 'qPqkkkkkkkkkkqPq',
		'qPqkkkkkkkkkkqpq', 'qPqkkkkkkkkkkqpq', '.qpqkkkkkkkkqpq.', '.qpqqkkkkkkqqpq.',
		'..qppqqqqqqppq..', '...qqppppppqq...', '.....qqqqqq.....', '................',
	],
	singleton: [
		'...kk......kk...', '...kRk....kRk...', '....kRk..kRk....', '....krRkkRrk....',
		'.....krRRrk.....', '....kkkkkkkk....', '...kGGGGGGggk...', '..kGYYGGGggggk..',
		'..kGYGGkkGgggk..', '..kGGGkkkGgggk..', '..kGGGGkkGgghk..', '..kGGGGkkGgghk..',
		'..kgGGkkkkghhk..', '...kgggggghhk...', '....kkkkkkkk....', '................',
	],
	flat_hand: [
		'.......kk.......', '......kGgk......', '.kkkkkkGgkkkkkk.', '.kGGGGGGggggggk.',
		'.kkkkkkGgkkkkkk.', '..k....Gg....k..', '.k.k...Gg...k.k.', '.k.k...Gg...k.k.',
		'k...k..Gg..k...k', 'kkkkk..Gg..kkkkk', 'kGGgk..Gg..kGGgk', '.kkk...Gg...kkk.',
		'.......Gg.......', '.....kkGgkk.....', '....kGGGgggk....', '....kkkkkkkk....',
	],
	minor_nobility: [
		'................', '................', '................', '.kk....kk....kk.',
		'.kGk..kGgk..kgk.', '.kGGkkGGggkkggk.', '.kGGGGGGggggggk.', '.kGnGGrGGgbgggk.',
		'.kGGGGGGggggggk.', '.kYYYYYYYYYYYYk.', '.kggggggghhhhhk.', '.kkkkkkkkkkkkkk.',
		'................', '................', '................', '................',
	],
	purist: [
		'................', '................', '....kkkkkkkk....', '...kBWBBBbbbk...',
		'..kBWWBBBbbbuk..', '.kBBWBBBbbbbuuk.', 'kkkkkkkkkkkkkkkk', '.kBBBBBbbbbbuuk.',
		'..kBBBBbbbbuuk..', '...kBBBbbbuuk...', '....kBBbbuuk....', '.....kBbbuk.....',
		'......kbuk......', '.......kk.......', '................', '................',
	],
	vulnerable: [
		'......kkkk......', '.....kWWWSk.....', '....kWWWWWSk....', '...kWWWWWWWSk...',
		'...kWWWWkWWSk...', '..kWWWWkWWWWSk..', '..kWWWWWkWWWSk..', '..kWWWWkWWWWSk..',
		'..kWWWkWkWWSSk..', '..kWWWWWWkWSSk..', '..kSWWWWWWSSSk..', '...kSWWWWSSSk...',
		'...kSSSSSSSSk...', '....kkSSSSkk....', '......kkkk......', '................',
	],
	partners_trust: [
		'................', '................', '..kkkk...kkkk...', '.kllrrk.krrrRk..',
		'klWlrrrkrrrrRRk.', 'klllrrrrrrrrRRk.', 'krlrrrrrrrrrRRk.', 'krrrrrrrrrrRRRk.',
		'.krrrrrrrrrRRk..', '..krrrrrrrRRk...', '...krrrrrRRk....', '....krrrRRk.....',
		'.....krRRk......', '......kRk.......', '.......k........', '................',
	],
	underdog: [
		'.kk..........kk.', 'keek........keek', 'keDek......keDek', 'keDDekkkkkkeDDek',
		'.keDDDDDDDDDDek.', '.kDDDDDDDDDDDDk.', 'kDDWkDDDDDDkWDDk', 'kDDkkDDDDDDkkDDk',
		'kDDDDDDDDDDDDDDk', '.kDDDDDkkDDDDDk.', '.kDDDDkkkkDDDDk.', '..kDDDDkkDDDDk..',
		'..kDDDDrrDDDDk..', '...kDDDrlDDDk...', '....kkkkkkkk....', '................',
	],
	bold_bidding: [
		'................', '................', '...........k....', '.........kkrk..k',
		'.......kkrrrk.k.', '.....kkrrrrrk...', '.kkkkrrrrrrrk.kk', '.kSSkrrrrrrrk...',
		'.kSWkrrrrrrRk.kk', '.kSSkrrrrrRRk...', '.kkkkrrrrRRRk.k.', '..ksk.kkrRRRk..k',
		'..ksk...kkRRk...', '..kkk.....kkk...', '................', '................',
	],
	crossruff: [
		'kk............kk', 'kWSk........kSWk', '.kWSk......kSWk.', '..kWSk....kSWk..',
		'...kWSk..kSWk...', '....kWSkkSWk....', '.....kWSSWk.....', '......kSSk......',
		'.....kGkkGk.....', '....kGgkkgGk....', '...kGgk..kgGk...', '..kekk....kkek..',
		'.kek........kek.', '.kk..........kk.', '................', '................',
	],
	rubber_baron: [
		'................', '....kkkkkkkk....', '....kstttttk....', '....kstttttk....',
		'....kstttttk....', '....kstttttk....', '....krrrrrRk....', '....kkkkkkkk....',
		'.kkkksttttttkkk.', 'kstttttttttttttk', '.kkkkkkkkkkkkkk.', '................',
		'...........kkk..', '..........kGgGk.', '..........kgGhk.', '...........kkk..',
	],
	insurance: [
		'.......kk.......', '.....kkBBkk.....', '...kkBBBbbbkk...', '..kBBBBbbbbbuk..',
		'.kBBBBBbbbbbuuk.', 'kBBBBBBbbbbbuuuk', 'kkkkkkkSkkkkkkkk', '.......Sk.......',
		'.B.....Sk....B..', '.......Sk.......', '...B...Sk.B.....', '.......SSkkSk...',
		'........kSSk....', '................', '................', '................',
	],
	club_regular: [
		'................', '.kkkkkkkkkkkkkk.', '.kWCCCCCCccccck.', '..kCCCCCccccck..',
		'...kCCCnvccck...', '....kCCnncck....', '.....kCCcck.....', '......kCck......',
		'.......kk.......', '.......Sk.......', '.......Sk.......', '.......Sk.......',
		'.....kkSkkk.....', '....kSSSSssk....', '....kkkkkkkk....', '................',
	],
	master_points: [
		'.....kkkkkk.....', '...kkBBbbBBkk...', '..kBBbkkkkbbBk..', '.kBbkGGGGggkbBk.',
		'.kbkGYYGGgggkbk.', '.kBkGYGGggggkBk.', '.kbkGGGgggghkbk.', '.kBkgGGgggghkBk.',
		'..kbkhgggghkbk..', '...kBbkkkkbBk...', '....kkbbbbkk....', '....krrk.krrk...',
		'...krRk...kRrk..', '...krk.....krk..', '...kk.......kk..', '................',
	],
	life_master: [
		'................', '..kkkkkkkkkkkk..', '.kGYYGGGGgggggk.', 'kkGYGGGGggggghkk',
		'kGkGGGGGgggghkgk', 'kGkGGGGGgggghkgk', '.kkGGGGGgggghkk.', '...kGGGgggghk...',
		'....kGGggghk....', '.....kGgghk.....', '......kGhk......', '......kGhk......',
		'.....kGGghk.....', '....keeeeeek....', '....kDDDDDek....', '....kkkkkkkk....',
	],
	slam_hunter: [
		'.....kkkkkk.....', '...kkrrrrrrkk...', '..krrWWWWWWrrk..', '.krWWrrrrrrWWrk.',
		'.krWrrWWWWrrWrk.', 'krWrWWrrrrWWrWrk', 'krWrWrrkkrrWrWrk', 'krWrWrkRRkrWrWrk',
		'krWrWrkRRkrWrWrk', 'krWrWrrkkrrWrWrk', 'krWrWWrrrrWWrWrk', '.krWrrWWWWrrWrk.',
		'.krWWrrrrrrWWrk.', '..krrWWWWWWrrk..', '...kkrrrrrrkk...', '.....kkkkkk.....',
	],
	the_finesse: [
		'...........Y....', '..........YyY...', '...Y.......Y....', '..YyY.....kk....',
		'...Y.....kWk....', '........kWtk....', '.......kWtk..Y..', '......kWtk..YyY.',
		'.....kttk....Y..', '....kttk........', '...kttk.........', '..kttk..........',
		'.kttk...........', '.kkk............', '................', '................',
	],
	grand_design: [
		'................', '................', '................', '.......kk.......',
		'......kGhk......', '.....kGGhhk.....', '....kGkGhkhk....', '...kGGGGhhhhk...',
		'..kGkGGGhhhkhk..', '.kGGGGGGhhhhhhk.', 'kGGkGGGGhhhhkhhk', 'kkkkkkkkkkkkkkkk',
		'.DDDDDDDDDDDDDD.', '................', '................', '................',
	],
	doubled_down: [
		'kkkkkkkk........', 'kWWWWWSk........', 'kWkWWWSk........', 'kWWWWWSk........',
		'kWWWWWSk........', 'kWWWkWSk........', 'kSSSSSSk........', 'kkkkkkkkkkkkkkkk',
		'........kWWWWWSk', '........kWkWkWSk', '........kWWWWWSk', '........kWkWkWSk',
		'........kWWWWWSk', '........kSSSSSSk', '........kkkkkkkk', '................',
	],
	slam_dunk: [
		'..kkkkk.........', '.kDDDDek........', 'kDDDDDDek.......', 'kDDDDDDek.......',
		'kDDDDDDek.......', '.kDDDDek........', '..kkkkkkk.......', '.....kDDek......',
		'......kDDek.....', '.......kDDek....', '........kDDek...', '.........kDek...',
		'..........kk....', '...kkkkkkkkkkk..', '..kDDDDDDDDDDek.', '..keeeeeeeeeeek.',
	],
	trump_coup: [
		'........kkkkk...', '.......kYYyyk...', '......kYYyyk....', '.....kYYyyk.....',
		'....kYYyyk......', '...kYYyykkkkk...', '..kYYyyyyyyyk...', '..kkkkkyyyyk....',
		'......kyyyk.....', '.....kyyyk......', '....kyyok.......', '...kyyok........',
		'...kyok.........', '..kyok..........', '..kok...........', '..kk............',
	],
	clean_sweep: [
		'.............kk.', '............kDk.', '...........kDk..', '..........kDk...',
		'.........kDk....', '........kDk.....', '.......kDk......', '.....kkrrk......',
		'....kGgRRk......', '...kGGgggk...S..', '..kGgGgGgk.S..S.', '.kGgGgGgGk......',
		'kGgGgGgGgk..S...', 'kgGgGgGgk.......', '.kkkkkkkk.......', '................',
	],
	the_rubber: [
		'.....kk..kk.....', '....kNk..kNk....', '...kNvk..kvNk...', '..kNvk....kvNk..',
		'..kNk......kNk..', '.kNvk......kvNk.', '.kNk........kNk.', '.kNvk......kvNk.',
		'..kNk......kNk..', '..kNvk....kvNk..', '...kNvk..kvNk...', '....kkkkkkkk....',
		'....krrRRrrk....', '.....krkkrk.....', '....krk..krk....', '....kk....kk....',
	],
	vienna_coup: [
		'.........kkkkkk.', '.......kkqPPPqk.', '.......kqqkkkqk.', '.......kqk..kqk.',
		'.......kqk..kqk.', '.......kqk..kqk.', '.......kqk..kqk.', '.......kqk..kqk.',
		'...kkkkkqk.kkqk.', '..kPPPqqqkkPPqqk', '.kPPqqqqqkPqqqqk', '.kPqqqqqkkqqqqk.',
		'..kqqqqk.kqqqk..', '...kkkk...kkk...', '................', '................',
	],
	kibitzer: [
		'................', '................', '...k..k..k..k...', '....kkkkkkkk....',
		'..kkWWWWWWWWkk..', '.kWWWWkkkkWWWWk.', 'kWWWWkBBbbkWWWSk', 'kWWWkBWkkbukWWSk',
		'kWWWkBkkkbukWWSk', 'kWWWkbbbbuukWSSk', '.kWWWkkkkkkWWSk.', '..kkWWWWWWSSkk..',
		'....kkkkkkkk....', '................', '................', '................',
	],
	double_dummy: [
		'................', '................', '................', 'k..............k',
		'k..............k', 'kkkkkkk..kkkkkkk', 'kBWBbbkkkkBWBbbk', 'kBBBbbk..kBBBbbk',
		'kBBbbuk..kBBbbuk', 'kbbbuuk..kbbbuuk', '.kkkkk....kkkkk.', '................',
		'................', '................', '................', '................',
	],
	redeal: [
		'kkkkkkk.........', 'kMmMmMk.........', 'kmMmMmk.........', 'kMmMkkkkkkk.....',
		'kmMmkMmMmMk.....', 'kMmMkmMmMmk.....', 'kmMmkMmMmkkkkkkk', 'kMmMkmMmMkWWWWWk',
		'kkkkkMmMmkWrWrWk', '....kmMmMkWrrrWk', '....kMmMmkWWrWWk', '....kkkkkkWWWWWk',
		'.........kWWWWWk', '.........kSSSSSk', '.........kkkkkkk', '................',
	],
	promotion: [
		'................', '.......kk.......', '......kGgk......', '.....kGGggk.....',
		'....kGGkkggk....', '...kGGk..kggk...', '..kGGk....kggk..', '..kkk..kk..kkk..',
		'......kGgk......', '.....kGGggk.....', '....kGGkkggk....', '...kGGk..kggk...',
		'..kGGk....kggk..', '..kkk......kkk..', '................', '................',
	],
	coup: [
		'..kk............', '..kSkkkkk.......', '..kSkrrrrkkk....', '..kSkrlrrrrrkk..',
		'..kSkrrrrrrrrrk.', '..kSkrrrrrrRRk..', '..kSkRrrrRRRk...', '..kSkkRRRkkk....',
		'..kSk.kkk.......', '..kSk...........', '..kSk...........', '..kSk...........',
		'.kkSkk..........', '.keeeek.........', 'kDDDDDDk........', 'kkkkkkkk........',
	],
	transfer: [
		'..........k.....', '..........kk....', '.kkkkkkkkkkBk...', '.kBBBBBBBBBBBk..',
		'.kbbbbbbbbbbuk..', '.kkkkkkkkkkuk...', '..........kk....', '..........k.....',
		'.....k..........', '....kk..........', '...kBkkkkkkkkkk.', '..kBBBBBBBBBBBk.',
		'..kubbbbbbbbbbk.', '...kukkkkkkkkkk.', '....kk..........', '.....k..........',
	],
	ruffing_void: [
		'.....kkkkkk.....', '...kkrrrrrrkk...', '..krrkkkkkkrrk..', '.krk......krrrk.',
		'.krk.....krrkrk.', 'krk.....krrk.krk', 'krk....krrk..krk', 'krk...krrk...krk',
		'krk..krrk....krk', 'krk.krrk.....krk', '.krkrrk.....krk.', '.krrrk......krk.',
		'..krrkkkkkkrrk..', '...kkrrrrrrkk...', '.....kkkkkk.....', '................',
	],
	strong_partner: [
		'................', '................', '................', '................',
		'.kkk........kkk.', 'kSSsk......kSSsk', 'kSSskkkkkkkkSSsk', 'kSSskWWWWWWkSSsk',
		'kSSskttttttkSSsk', 'kSSskkkkkkkkSSsk', 'kSSsk......kSSsk', '.kkk........kkk.',
		'................', '................', '................', '................',
	],
	lead_out_of_turn: [
		'.....kkkkkk.....', '...kkNNNNNNkk...', '..kNNNNNNNNnnk..', '.kNNNkkNNNnnnvk.',
		'.kNNNkWkkNnnnvk.', 'kNNNNkWWWkknnvvk', 'kNNNNkWWWWWknvvk', 'kNNNNkWWWWWWkvvk',
		'kNNNnkWWWWWknvvk', 'kNNnnkWWWkknnvvk', '.knnnkWkknnnvvk.', '.knnnkknnnnvvvk.',
		'..knnnnnnnvvvk..', '...kkvvvvvvkk...', '.....kkkkkk.....', '................',
	],
	psych: [
		'................', '..kkkkkkkkkkkk..', '.kPPPPPPPPPPppk.', 'kPPWPPPPPPPPpppk',
		'kPkkkPPPPkkkpppk', 'kPkkkkPPkkkkpppk', 'kPPkkPPPPkkPpppk', 'kPPPPPPPPPPPpppk',
		'kPPPPPPkPPPPpppk', '.kPPkPPPPPPkppk.', '.kPPPkkkkkkPppk.', '..kPPPPPPPPppk..',
		'...kqPPPPPqqk...', '....kkqqqqkk....', '......kkkk......', '................',
	],
	table_talk: [
		'................', '.kkkkkkkkkk.....', 'kCCCCCCCCcck....', 'kCkkkkkkkcck....',
		'kCCCCCCCCcck....', 'kCkkkkkcccck....', 'kcccccccccck....', '.kkkkcckkkkk....',
		'....kck.kkkkkkk.', '....kk.kPPPPPPpk', '......kPkkkkkppk', '......kPPPPPPppk',
		'......kPkkkpppk.', '......kppppppppk', '.......kkkkkkpk.', '............kk..',
	],
	phantom_trick: [
		'.....kkkkkk.....', '...kkWWWWWWkk...', '..kWWWWWWWWWSk..', '.kWWWWWWWWWWSSk.',
		'.kWWkkWWWkkWSSk.', 'kWWWkkWWWkkWWSSk', 'kWWWkuWWWkuWWSSk', 'kWWWWWWWWWWWWSSk',
		'kWWWWWkkkWWWWSSk', 'kWWWWkWWWkWWWSSk', 'kWWWWWkkkWWWSSSk', 'kWWWWWWWWWWSSSSk',
		'kWWWWWWWWWSSSSSk', 'kWWkWWWkWWWkSSSk', 'kWk.kWk.kWk.kSk.', '.k...k...k...k..',
	],
	safety_net: [
		'................', 'kk............kk', 'ke............ek', 'keDDDDDDDDDDDDek',
		'keD..DD..DD..Dek', 'ke.DD..DD..DD.ek', 'ke.DD..DD..DD.ek', 'keD..DD..DD..Dek',
		'ke.DDDDDDDDDD.ek', 'ke..DDDDDDDD..ek', 'ke............ek', 'ke............ek',
		'keek........keek', 'kDDk........kDDk', 'kkkk........kkkk', '................',
	],
	high_stakes: [
		'......kkkk......', '.....kDeeDk.....', '......kDDk......', '.....kkrrkk.....',
		'....kDDDDDdk....', '...kDDDGGDDdk...', '..kDDDGkGGDDdk..', '.kDDDDGGkDDDddk.',
		'.kDDDDDGGGDDddk.', '.kDDDDDDkGGDddk.', '.kDDDDGGGDDdddk.', '.kDDDDDkDDDdddk.',
		'..kDDDDDDDdddk..', '...kdddddddddk..', '....kkkkkkkkk...', '................',
	],
	vanderbilt: [
		'kkkkkkkkkk......', 'kMmMmMmMmk......', 'kmMmMmMmMk......', 'kMmMmkkkkkkkkkkk',
		'kmMmMkWWWWWWWWWk', 'kMmMmkWgWWWWWgWk', 'kmMmMkWgWWWWWgWk', 'kMmMmkWWgWWWgWWk',
		'kmMmMkWWgWWWgWWk', 'kMmMmkWWWgWgWWWk', 'kmMmMkWWWgWgWWWk', 'kkkkkkWWWWGWWWSk',
		'.....kWWWWWWWWSk', '.....kSSSSSSSSSk', '.....kkkkkkkkkkk', '................',
	],
};

const FALLBACK = [
	'................', '.....kkkkkk.....', '....kk....kk....', '..........kk....',
	'.........kk.....', '........kk......', '.......kk.......', '.......kk.......',
	'................', '.......kk.......', '.......kk.......', '................',
	'................', '................', '................', '................',
];

/** Bitmap for an icon on its cream tile (18x18: a 1px rim around 16x16). */
export function bitmap(key: string): Bitmap {
	const rows = ICONS[key] ?? FALLBACK;
	const T = TILE;
	const b = newBitmap(T, T);
	const P = PALETTE;
	// Tile: lighter top half, darker bottom half, rounded corners.
	b.fillRect(1, 1, T - 2, (T - 2) / 2, hex('#f2e8d0'));
	b.fillRect(1, 1 + (T - 2) / 2, T - 2, (T - 2) / 2, hex('#e6d8b8'));
	b.fillRect(2, 0, T - 4, 1, P.k);
	b.fillRect(2, T - 1, T - 4, 1, P.k);
	b.fillRect(0, 2, 1, T - 4, P.k);
	b.fillRect(T - 1, 2, 1, T - 4, P.k);
	b.set(1, 1, P.k);
	b.set(T - 2, 1, P.k);
	b.set(1, T - 2, P.k);
	b.set(T - 2, T - 2, P.k);
	b.sprite(rows, P, 1, 1);
	return b;
}
