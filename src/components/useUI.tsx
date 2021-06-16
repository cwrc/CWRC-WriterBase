import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import BlockIcon from '@material-ui/icons/Block';
import CallSplitIcon from '@material-ui/icons/CallSplit';
import ContentCopyIcon from '@material-ui/icons/ContentCopy';
import ContentPasteIcon from '@material-ui/icons/ContentPaste';
import EditIcon from '@material-ui/icons/Edit';
import EventRoundedIcon from '@material-ui/icons/EventRounded';
import LabelRoundedIcon from '@material-ui/icons/LabelRounded';
import LinkRoundedIcon from '@material-ui/icons/LinkRounded';
import MergeTypeIcon from '@material-ui/icons/MergeType';
import PlaceIcon from '@material-ui/icons/Place';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';
import ReportRoundedIcon from '@material-ui/icons/ReportRounded';
import StickyNote2Icon from '@material-ui/icons/StickyNote2';
import VpnKeyRoundedIcon from '@material-ui/icons/VpnKeyRounded';

import BookIcon from '@src/icons/custom/Book';
import BoxOpenIcon from '@src/icons/custom/BoxOpen';
import CitationCardIcon from '@src/icons/custom/CitationCard';
import OrganizationIcon from '@src/icons/custom/Organization';
import PersonIcon from '@src/icons/custom/Person';

const icons: Map<string, any> = new Map();
icons.set('add', AddCircleOutlineIcon);
icons.set('remove', RemoveCircleOutlineIcon);
icons.set('edit', EditIcon);
icons.set('copy', ContentCopyIcon);
icons.set('paste', ContentPasteIcon);
icons.set('split', CallSplitIcon);
icons.set('merge', MergeTypeIcon);

icons.set('person', PersonIcon);
icons.set('place', PlaceIcon);
icons.set('organization', OrganizationIcon);
icons.set('title', BookIcon);
icons.set('referencing_string', BoxOpenIcon);
icons.set('citation', CitationCardIcon);
icons.set('note', StickyNote2Icon);
icons.set('date', EventRoundedIcon);
icons.set('correction', ReportRoundedIcon);
icons.set('keyword', VpnKeyRoundedIcon);
icons.set('link', LinkRoundedIcon);

icons.set('tags', LabelRoundedIcon);

icons.set('block', BlockIcon);

export const useUI = () => {
  return {
    getIcon: (name?: string) => {
      if (!name) return null;
      const icon = icons.get(name);
      if (!icon) return null;
      return icon;
    },
  };
};

export default useUI;
