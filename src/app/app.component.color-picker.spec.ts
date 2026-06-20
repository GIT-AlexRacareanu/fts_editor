import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppComponent } from './app.component';
import { AppModule } from './app.module';
import { FileHandleStorageService } from './services/file-handle-storage.service';
import { PakEditorService } from './services/pak-editor.service';
import { PlayerImportService } from './services/player-import.service';
import { PlayerService } from './services/player.service';
import { TeamEditorService } from './services/team-editor.service';
import { TeamsDatService } from './services/teams-dat.service';
import { XlcEditorService } from './services/xlc-editor.service';

describe('AppComponent color sliders', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let teamsDatService: {
    hasData: boolean;
    teamOptions: Array<{ value: number; label: string }>;
    kitStyleOptions: Array<{ value: number; label: string }>;
    sponsorTypeOptions: Array<{ value: number; label: string }>;
    europeanCompetitionOptions: Array<{ value: number; label: string }>;
    stadiumNameMaxLength: number;
    records: any[];
    updateKitColor: jasmine.Spy;
    updateStadiumColor: jasmine.Spy;
  };

  beforeEach(async () => {
    teamsDatService = {
      hasData: true,
      teamOptions: [],
      kitStyleOptions: [],
      sponsorTypeOptions: [],
      europeanCompetitionOptions: [],
      stadiumNameMaxLength: 23,
      records: [
        {
          index: 0,
          teamId: 99,
          stadiumName: 'Arena',
          stadiumColor: { hex: '#102030', rawHex: '3020107F', fileOffset: 0x10F8, byteOffset: 0x10EC },
          pitchType: 3,
          linesUL: 11,
          linesUV: 22,
          linesPL: 33,
          linesPV: 44,
          kits: [
            {
              kitIndex: 0,
              label: 'Home',
              styleId: 0,
              styleLabel: 'Style 0',
              styleFileOffset: 0xBC,
              colors: [
                { colorIndex: 0, label: 'Primary', hex: '#445566', rawHex: '6655447F', fileOffset: 0x24 }
              ]
            }
          ]
        }
      ],
      updateKitColor: jasmine.createSpy('updateKitColor'),
      updateStadiumColor: jasmine.createSpy('updateStadiumColor')
    };

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        {
          provide: PlayerService,
          useValue: {
            getOvrTuningConfig: () => [],
            readPlayer: () => ({ pos: 11, nat: 0 }),
            getPlayerNameByIndex: () => 'Player',
            findPlayerIndexByName: () => -1,
            parsePlayerId: () => -1,
            formatPlayerId: () => '0001',
            calculateOVR: () => 70,
            binaryData: null,
            totalPlayers: 0
          }
        },
        {
          provide: PlayerImportService,
          useValue: {
            filterByTeam: () => [],
            mapImportedPlayer: () => ({ pos: 11, nat: 0 })
          }
        },
        {
          provide: PakEditorService,
          useValue: {
            hasData: false
          }
        },
        {
          provide: TeamEditorService,
          useValue: {
            hasData: false,
            teamOptions: [],
            getTeam: () => ({ offset: 0, teamId: 0, teamLabel: 'Team 0', playerCount: 0, slots: [] }),
            searchTeams: () => []
          }
        },
        {
          provide: TeamsDatService,
          useValue: teamsDatService
        },
        {
          provide: XlcEditorService,
          useValue: {
            getLocaleValueByKey: () => null,
            entries: []
          }
        },
        {
          provide: FileHandleStorageService,
          useValue: {
            getFileHandle: async () => null,
            saveFileHandle: async () => undefined,
            deleteFileHandle: async () => undefined
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    spyOn<any>(component, 'registerRuntimeDebugHandlers').and.stub();
    spyOn<any>(component, 'initializeApp').and.returnValue(Promise.resolve());
  });

  it('updates the stadium color when the RGB slider change is committed', () => {
    component.showTeamStadiumDialog = true;
    component.teamStadiumDialogRecordIndex = 0;

    fixture.detectChanges();

    const input: HTMLInputElement | null = fixture.nativeElement.querySelector('.stadium-dialog-color-control .teams-dat-rgb-slider-input[data-channel="R"]');
    expect(input).not.toBeNull();

    input!.value = '17';
    input!.dispatchEvent(new Event('change'));

    expect(teamsDatService.updateStadiumColor).toHaveBeenCalledOnceWith(0, '#112030');
  });

  it('updates the kit color when the RGB slider change is committed', () => {
    component.showTeamKitDialog = true;
    component.teamKitDialogRecordIndex = 0;

    fixture.detectChanges();

    const input: HTMLInputElement | null = fixture.nativeElement.querySelector('.teams-dat-kit-color-control .teams-dat-rgb-slider-input[data-channel="R"]');
    expect(input).not.toBeNull();

    input!.value = '17';
    input!.dispatchEvent(new Event('change'));

    expect(teamsDatService.updateKitColor).toHaveBeenCalledOnceWith(0, 0, 0, '#115566');
  });
});