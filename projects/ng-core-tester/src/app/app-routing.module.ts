/*
 * RERO angular core
 * Copyright (C) 2020 RERO
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { NgModule } from '@angular/core';
import { RouterModule, Routes, UrlSegment } from '@angular/router';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { ActionStatus } from '@rero/ng-core';
import { JSONSchema7 } from 'json-schema';
import { Observable, of } from 'rxjs';
import { HomeComponent } from './home/home.component';
import { DetailComponent } from './record/document/detail/detail.component';
import { DocumentComponent } from './record/document/document.component';
import { RouteService } from './routes/route.service';
import { RecordDetailDirective } from '@rero/ng-core/lib/record/detail/detail.directive';

/**
 * Disallows access to admin functionalities.
 */
const adminModeCanNot = (): Observable<ActionStatus> => {
  return of({
    can: false,
    message: ''
  });
};

/**
 * Allows access to admin functionalities.
 */
const adminModeCan = (): Observable<ActionStatus> => {
  return of({
    can: true,
    message: ''
  });
};

/**
 * Whether user can add a record.
 */
const canAdd = (record: any): Observable<ActionStatus> => {
  return of({
    // can: Math.random() >= 0.5,
    can: true,
    message: ''
  });
};

/**
 * Whether user can update a record.
 */
const canUpdate = (record: any): Observable<ActionStatus> => {
  return of({
    // can: Math.random() >= 0.5,
    can: true,
    message: ''
  });
};

/**
 * Whether user can delete a record.
 */
const canDelete = (record: any): Observable<ActionStatus> => {
  return of({
    // can: Math.random() >= 0.5,
    can: true,
    message: `You <strong>cannot</strong> delete this record #${record.id} !`
  });
};

/**
 * Whether user can read a record.
 */
const canRead = (record: any): Observable<ActionStatus> => {
  return of({
    // can: Math.random() >= 0.5,
    can: true,
    message: ''
  });
};

// Permissions override simple canRead, canUpdate and canDelete if defined
const permissions = (record: any) => {
  const perms = record.metadata.permissions;
  perms.read = true;
  perms.update = true;
  perms.delete = false;

  return {
    canRead: of({
        can: perms.read,
        message: ''
    }),
    canUpdate: of({
        can: perms.update,
        message: ''
    }),
    canDelete: of({
        can: perms.delete,
        message: ''
    })
  };
};

const formFieldMap = (field: FormlyFieldConfig, jsonSchema: JSONSchema7): FormlyFieldConfig => {
  // Populates "type" field with custom options
  const formOptions = jsonSchema.form;
  if (formOptions && formOptions.field === 'type') {
    field.type = 'select';
    field.templateOptions.options = [
      { label: 'Type 1', value: 'type 1' },
      { label: 'Type 2', value: 'type 2' }
    ];
    field.defaultValue = 'type 2';
  }

  return field;
};

/**
 * Custom treatment for aggregations.
 */
const aggregations = (agg: object) => {
  return of(agg);
};

/**
 * Returned matched URL.
 *
 * @param url List of URL segments.
 * @return Object representing the matched URL.
 */
export function matchedUrl(url: UrlSegment[]) {
  const segments = [new UrlSegment(url[0].path, {})];

  return {
    consumed: segments,
    posParams: { type: new UrlSegment(url[1].path, {}) }
  };
}

/**
 * URL matchs document resource.
 *
 * @param url List of URL segments.
 * @return Object representing the matched URL.
 */
export function documentsMatcher(url: Array<UrlSegment>) {
  if (url[0].path === 'records' && url[1].path === 'documents') {
    return matchedUrl(url);
  }
  return null;
}

/**
 * URL matchs organisation resource.
 *
 * @param url List of URL segments.
 * @return Object representing the matched URL.
 */
export function organisationsMatcher(url: Array<UrlSegment>) {
  if (url[0].path === 'records' && url[1].path === 'organisations') {
    return matchedUrl(url);
  }
  return null;
}

/**
 * List of routes for application.
 */
const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    matcher: documentsMatcher,
    loadChildren: () => import('./record-wrapper/record-wrapper.module').then(m => m.RecordWrapperModule),
    data: {
      showSearchInput: true,
      adminMode: adminModeCanNot,
      types: [
        {
          key: 'documents',
          label: 'Documents',
          component: DocumentComponent
        }
      ]
    }
  },
  {
    matcher: organisationsMatcher,
    loadChildren: () => import('./record-wrapper/record-wrapper.module').then(m => m.RecordWrapperModule),
    data: {
      showSearchInput: true,
      adminMode: adminModeCanNot,
      types: [
        {
          key: 'organisations',
          label: 'Organisations'
        }
      ]
    }
  },
  {
    path: 'unisi/record/search',
    loadChildren: () => import('./record-wrapper/record-wrapper.module').then(m => m.RecordWrapperModule),
    data: {
      showSearchInput: true,
      adminMode: adminModeCanNot,
      types: [
        {
          key: 'documents',
          label: 'Documents',
          component: DocumentComponent,
          preFilters: {
            organisation: 'unisi'
          }
        }
      ]
    }
  },
  {
    path: 'admin/record/search',
    loadChildren: () => import('./record-wrapper/record-wrapper.module').then(m => m.RecordWrapperModule),
    data: {
      types: [
        {
          key: 'documents',
          label: 'Documents',
          component: DocumentComponent,
          detailComponent: DetailComponent,
          canAdd,
          canUpdate,
          canDelete,
          canRead,
          permissions,
          aggregations,
          adminMode: adminModeCan,
          aggregationsBucketSize: 8,
          aggregationsExpand: ['language'],
          formFieldMap,
          listHeaders: {
            'Content-Type': 'application/rero+json'
          },
          itemHeaders: {
            'Content-Type': 'application/rero+json'
          },
          filesEnabled: true,
          searchFields: [
            {
              label: 'Full-text',
              path: 'fulltext'
            },
            {
              label: 'Main title',
              path: 'title.mainTitle.value'
            }
          ]
        },
        {
          key: 'organisations',
          label: 'Organisations'
        }
      ]
    }
  }
];

/**
 * Routing module for application.
 */
@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
  /**
   * Constructor
   *
   * Intializes routes.
   *
   * @param _routeService Route service
   */
  constructor(private _routeService: RouteService) {
    this._routeService.initializeRoutes();
  }
}
