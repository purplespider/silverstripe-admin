<?php

namespace SilverStripe\Admin;

use SilverStripe\ORM\FieldType\DBField;
use SilverStripe\Security\Group;
use SilverStripe\Security\MemberCsvBulkLoader;
use SilverStripe\Forms\LiteralField;
use SilverStripe\Forms\FileField;
use SilverStripe\Forms\FieldList;
use SilverStripe\Forms\FormAction;
use SilverStripe\Forms\RequiredFields;
use SilverStripe\Forms\Form;
use SilverStripe\View\Requirements;

/**
 * Imports {@link Member} records by CSV upload, as defined in
 * {@link MemberCsvBulkLoader}.
 */
class MemberImportForm extends Form
{

    /**
     * @var Group Optional group relation
     */
    protected $group;

    public function __construct($controller, $name, $fields = null, $actions = null, $validator = null)
    {
        if (!$fields) {
            $helpHtml = _t(
                'SilverStripe\\Admin\\MemberImportForm.Help1',
                '<p>Import users in <em>CSV format</em> (comma-separated values).'
                . ' <small><a href="#" class="toggle-advanced">Show advanced usage</a></small></p>'
            );
            $helpHtml .= _t(
                'SilverStripe\\Admin\\MemberImportForm.Help2',
                '<div class="advanced">'
                . '<h4>Advanced usage</h4>'
                . '<ul>'
                . '<li>Allowed columns: <em>%s</em></li>'
                . '<li>Existing users are matched by their unique <em>Code</em> property, and updated with any new values from '
                . 'the imported file.</li>'
                . '<li>Groups can be assigned by the <em>Groups</em> column. Groups are identified by their <em>Code</em> property, '
                . 'multiple groups can be separated by comma. Existing group memberships are not cleared.</li>'
                . '</ul>'
                . '</div>'
            );

            $importer = new MemberCsvBulkLoader();
            $importSpec = $importer->getImportSpec();
            $helpHtml = sprintf($helpHtml, implode(', ', array_keys($importSpec['fields'])));

            $fields = new FieldList(
                new LiteralField('Help', $helpHtml),
                $fileField = new FileField(
                    'CsvFile',
                    DBField::create_field('HTMLFragment', _t(
                        'SilverStripe\\Admin\\MemberImportForm.FileFieldLabel',
                        'CSV File <small>(Allowed extensions: *.csv)</small>'
                    ))
                )
            );
            $fileField->getValidator()->setAllowedExtensions(array('csv'));
        }

        if (!$actions) {
            $action = new FormAction('doImport', _t('SilverStripe\\Admin\\MemberImportForm.BtnImport', 'Import from CSV'));
            $action->addExtraClass('btn btn-secondary-outline font-icon-upload');
            $actions = new FieldList($action);
        }

        if (!$validator) {
            $validator = new RequiredFields('CsvFile');
        }

        parent::__construct($controller, $name, $fields, $actions, $validator);

        Requirements::javascript('silverstripe/admin:client/dist/js/vendor.js');
        Requirements::javascript('silverstripe/admin:client/dist/js/MemberImportForm.js');
        Requirements::css('silverstripe/admin:client/dist/styles/bundle.css');

        $this->addExtraClass('cms');
        $this->addExtraClass('import-form');
    }

    public function doImport($data, $form)
    {
        $loader = new MemberCsvBulkLoader();

        // optionally set group relation
        if ($this->group) {
            $loader->setGroups(array($this->group));
        }

        // load file
        $result = $loader->load($data['CsvFile']['tmp_name']);

        // result message
        $msgArr = array();
        if ($result->CreatedCount()) {
            $msgArr[] = _t(
                'SilverStripe\\Admin\\MemberImportForm.ResultCreated',
                'Created {count} members',
                array('count' => $result->CreatedCount())
            );
        }
        if ($result->UpdatedCount()) {
            $msgArr[] = _t(
                'SilverStripe\\Admin\\MemberImportForm.ResultUpdated',
                'Updated {count} members',
                array('count' => $result->UpdatedCount())
            );
        }
        if ($result->DeletedCount()) {
            $msgArr[] = _t(
                'SilverStripe\\Admin\\MemberImportForm.ResultDeleted',
                'Deleted %d members',
                array('count' => $result->DeletedCount())
            );
        }
        $msg = ($msgArr) ? implode(',', $msgArr) : _t('SilverStripe\\Admin\\MemberImportForm.ResultNone', 'No changes');

        $this->sessionMessage($msg, 'good');

        $this->controller->redirectBack();
    }

    /**
     * @param $group Group
     */
    public function setGroup($group)
    {
        $this->group = $group;
    }

    /**
     * @return Group
     */
    public function getGroup($group)
    {
        return $this->group;
    }
}
